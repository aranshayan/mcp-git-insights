import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitError";
  }
}

const SAFE_REF = /^[A-Za-z0-9_./~^@{}:+-]+$/;
const SAFE_DATE = /^[A-Za-z0-9 :.,+_-]+$/;

/** Refs/revisions may not start with "-" (option injection) or contain shell-ish characters. */
export function assertRef(ref: string, label = "ref"): string {
  if (!ref || ref.startsWith("-") || !SAFE_REF.test(ref)) {
    throw new GitError(`Invalid ${label}: "${ref.slice(0, 80)}".`);
  }
  return ref;
}

export function assertDate(value: string, label: string): string {
  if (value.startsWith("-") || !SAFE_DATE.test(value)) throw new GitError(`Invalid ${label}: "${value.slice(0, 80)}".`);
  return value;
}

export interface RunOptions {
  maxBytes?: number;
  timeoutMs?: number;
}

export function runGit(cwd: string, args: string[], opts: RunOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["-c", "core.pager=cat", "-c", "core.fsmonitor=false", "-c", "core.quotepath=off", "-c", "protocol.ext.allow=never", ...args],
      {
        cwd,
        maxBuffer: opts.maxBytes ?? 8 * 1024 * 1024,
        timeout: opts.timeoutMs ?? 20_000,
        env: {
          PATH: process.env.PATH ?? "",
          HOME: process.env.HOME ?? "",
          GIT_TERMINAL_PROMPT: "0",
          GIT_OPTIONAL_LOCKS: "0",
          GIT_CONFIG_NOSYSTEM: "1",
          LC_ALL: "C",
        },
        encoding: "utf8",
      },
      (err, stdout, stderr) => {
        if (!err) return resolve(stdout);
        const e = err as NodeJS.ErrnoException & { killed?: boolean; code?: string | number };
        if (e.code === "ENOENT") return reject(new GitError("git is not installed or not on PATH."));
        if (e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") return resolve(stdout); // output cap reached
        if (e.killed) return reject(new GitError("git command timed out."));
        reject(new GitError((stderr || e.message).trim().split("\n").slice(0, 3).join(" ").slice(0, 400)));
      },
    );
  });
}

const within = (root: string, target: string): boolean => {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

/** Resolves `input` to a git top-level directory that lies inside one of the allowed roots. */
export async function resolveRepo(input: string | undefined, roots: string[]): Promise<string> {
  const realRoots = await Promise.all(roots.map((r) => realpath(r)));
  let candidate: string;
  try {
    candidate = await realpath(path.resolve(input ?? realRoots[0]!));
  } catch {
    throw new GitError(`Path not found: ${input}`);
  }
  if (!realRoots.some((r) => within(r, candidate))) {
    throw new GitError(`Path is outside the allowed roots (${realRoots.join(", ")}).`);
  }
  const top = (await runGit(candidate, ["rev-parse", "--show-toplevel"]).catch(() => {
    throw new GitError(`Not a git repository: ${candidate}`);
  })).trim();
  const realTop = await realpath(top);
  if (!realRoots.some((r) => within(r, realTop))) {
    throw new GitError("Repository root is outside the allowed roots.");
  }
  return realTop;
}

/** Validates a repo-relative path and returns it in POSIX form. */
export async function safeRelPath(repo: string, p: string): Promise<string> {
  const abs = path.resolve(repo, p);
  if (!within(repo, abs)) throw new GitError(`Path escapes the repository: ${p}`);
  return path.relative(repo, abs).split(path.sep).join("/");
}

export function redactUrl(url: string): string {
  return url.replace(/(\w+:\/\/)[^@/\s]+@/, "$1***@");
}
