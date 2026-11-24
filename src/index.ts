#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { NAME, VERSION } from "./version.js";

const HELP = `mcp-git-insights — read-only Git tools for MCP

Usage: npx @aranshayan/mcp-git-insights [--root <dir> ...]

  --root <dir>   folder whose repositories may be inspected (repeatable; default: current directory)
                 also: MCP_GIT_ROOTS (separated by ${path.delimiter})
  -h, --help   -v, --version
`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { root: { type: "string", multiple: true }, help: { type: "boolean", short: "h" }, version: { type: "boolean", short: "v" } },
  });
  if (values.help) return void process.stdout.write(HELP);
  if (values.version) return void process.stdout.write(`${NAME} ${VERSION}\n`);
  const roots = (values.root?.length ? values.root : (process.env.MCP_GIT_ROOTS ?? "").split(path.delimiter).filter(Boolean)).map((r) => path.resolve(r));
  if (roots.length === 0) roots.push(process.cwd());

  const server = createServer(roots);
  const shutdown = async (): Promise<void> => {
    await server.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.stdin.on("close", shutdown);
  await server.connect(new StdioServerTransport());
  console.error(`${NAME} ${VERSION} ready, roots: ${roots.join(", ")}`);
}

main().catch((err: unknown) => {
  console.error(`${NAME}: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
