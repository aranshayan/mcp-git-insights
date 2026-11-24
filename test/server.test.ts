import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { connect, type Harness } from "./helpers.js";

let base: string;
let repo: string;
let outside: string;
let h: Harness;

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "Ann", GIT_AUTHOR_EMAIL: "ann@example.com", GIT_COMMITTER_NAME: "Ann", GIT_COMMITTER_EMAIL: "ann@example.com", GIT_CONFIG_GLOBAL: "/dev/null" } });
const commit = (msg: string) => git(repo, "commit", "-q", "-am", msg);

beforeAll(async () => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "mcp-git-")));
  repo = join(base, "repo");
  outside = join(base, "outside");
  mkdirSync(repo);
  mkdirSync(outside);
  git(repo, "init", "-q", "-b", "main");
  writeFileSync(join(repo, "a.txt"), "one\ntwo\nthree\n");
  git(repo, "add", ".");
  commit("chore: initial");
  git(repo, "tag", "v1");
  writeFileSync(join(repo, "a.txt"), "one\nTWO\nthree\n");
  commit("feat(core): add thing");
  writeFileSync(join(repo, "a.txt"), "one\nTWO\nthree\nfour\n");
  commit("fix: handle four");
  writeFileSync(join(repo, "a.txt"), "one\nTWO\nthree\nfour\nfive\n");
  commit("feat!: drop legacy");
  git(repo, "remote", "add", "origin", "https://user:token@example.com/x.git");
  git(outside, "init", "-q");
  writeFileSync(join(outside, "secret.txt"), "secret\n");
  symlinkSync(outside, join(repo, "link"));
  h = await connect(createServer([repo]));
});
afterAll(async () => {
  await h?.close();
  rmSync(base, { recursive: true, force: true });
});

const data = async (name: string, args: Record<string, unknown> = {}) => {
  const r = await h.call(name, args);
  return { ...r, json: (() => { try { return JSON.parse(r.text); } catch { return null; } })() };
};

describe("tools", () => {
  it("is read-only and exposes six tools", async () => {
    expect(await h.toolNames()).toEqual(["changelog", "git_blame", "git_diff", "git_log", "git_show", "repo_summary"]);
    const tools = (await h.client.listTools()).tools;
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
  });

  it("summarises the repo and redacts remote credentials", async () => {
    const { json } = await data("repo_summary");
    expect(json).toMatchObject({ branch: "main", commits: 4, changedFiles: 1 /* the untracked symlink fixture */ });
    expect(json.remotes).toEqual(["origin https://***@example.com/x.git"]);
    expect(json.topContributors[0]).toEqual({ commits: 4, name: "Ann" });
  });

  it("logs with filters", async () => {
    expect((await data("git_log")).json.count).toBe(4);
    expect((await data("git_log", { grep: "feat" })).json.count).toBe(2);
    expect((await data("git_log", { ref: "v1..HEAD", limit: 1 })).json.commits[0].subject).toBe("feat!: drop legacy");
    expect((await data("git_log", { path: "a.txt", follow: true })).json.count).toBe(4);
    expect((await data("git_log", { author: "nobody" })).json.count).toBe(0);
  });

  it("shows commits and diffs", async () => {
    const show = await data("git_show", { rev: "HEAD~1" });
    expect(show.text).toContain("fix: handle four");
    expect(show.text).toContain("+four");
    expect((await data("git_diff", { base: "v1", head: "HEAD", stat_only: true })).text).toMatch(/a\.txt \| 4/);
    expect((await data("git_diff")).text).toBe("(no differences)");
  });

  it("blames lines", async () => {
    const { json } = await data("git_blame", { path: "a.txt", start_line: 2, end_line: 2 });
    expect(json.lines[0]).toMatchObject({ line: 2, code: "TWO", summary: "feat(core): add thing", author: "Ann" });
  });

  it("generates a grouped changelog with breaking changes", async () => {
    const { text } = await data("changelog", { from: "v1" });
    expect(text).toMatch(/## Breaking changes\n- drop legacy/);
    expect(text).toContain("## Features");
    expect(text).toContain("- **core:** add thing");
    expect(text).toContain("## Bug fixes\n- handle four");
    expect(text).not.toContain("initial");
  });

  it("truncates huge output", async () => {
    const r = await data("git_show", { rev: "HEAD", max_chars: 1000, patch: true });
    expect(r.text.length).toBeLessThan(1200 + 200);
  });
});

describe("security", () => {
  it("rejects option injection in refs, dates and paths", async () => {
    const marker = join(base, "pwned");
    for (const [name, args] of [
      ["git_show", { rev: `--output=${marker}` }],
      ["git_diff", { base: "--output=" + marker }],
      ["git_log", { ref: "--all" }],
      ["git_log", { since: `--output=${marker}` }],
      ["changelog", { from: "-p" }],
    ] as const) {
      expect((await data(name, { ...args })).isError, name + JSON.stringify(args)).toBe(true);
    }
    expect(existsSync(marker)).toBe(false);
  });

  it("keeps a leading-dash author/grep harmless (passed as attached values)", async () => {
    expect((await data("git_log", { author: "--output=/tmp/x" })).isError).toBe(false);
    expect((await data("git_log", { grep: "-p" })).isError).toBe(false);
  });

  it("blocks paths and repos outside the allowed root", async () => {
    expect((await data("git_log", { path: "../outside/secret.txt" })).text).toMatch(/escapes/);
    expect((await data("git_show", { path: "/etc/passwd" })).isError).toBe(true);
    expect((await data("repo_summary", { repo: outside })).text).toMatch(/outside the allowed roots/);
    expect((await data("repo_summary", { repo: join(repo, "link") })).text).toMatch(/outside the allowed roots/);
    expect((await data("repo_summary", { repo: "/" })).isError).toBe(true);
  });

  it("reports non-repositories cleanly", async () => {
    const h2 = await connect(createServer([base]));
    const r = await h2.call("repo_summary", { repo: base });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/Not a git repository/);
    await h2.close();
  });
});
