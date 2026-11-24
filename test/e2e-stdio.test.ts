import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const bin = join(root, "dist", "index.js");
beforeAll(() => void execFileSync("npx", ["tsup"], { cwd: root, stdio: "ignore" }), 120_000);

describe("cli over stdio", () => {
  it("serves this repo's folder and rejects outside roots", async () => {
    const client = new Client({ name: "e2e", version: "1.0.0" });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [bin, "--root", root], env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" } }));
    try {
      expect((await client.listTools()).tools).toHaveLength(6);
      const res = await client.callTool({ name: "repo_summary", arguments: { repo: "/" } });
      expect(res.isError).toBe(true);
    } finally {
      await client.close();
    }
  }, 30_000);
  it("prints version and help", () => {
    expect(spawnSync(process.execPath, [bin, "-v"], { encoding: "utf8" }).stdout).toMatch(/^mcp-git-insights \d/);
    expect(spawnSync(process.execPath, [bin, "-h"], { encoding: "utf8" }).stdout).toMatch(/--root/);
  });
});
