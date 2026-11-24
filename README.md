# mcp-git-insights

[![CI](https://github.com/aranshayan/mcp-git-insights/actions/workflows/ci.yml/badge.svg)](https://github.com/aranshayan/mcp-git-insights/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@aranshayan/mcp-git-insights)](https://www.npmjs.com/package/@aranshayan/mcp-git-insights)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Read-only Git history and code archaeology for [MCP](https://modelcontextprotocol.io) clients.** Ask "who changed this and why?", "what shipped since v1.4?", "summarise this branch" — without giving the model a shell.

- **Cannot modify anything.** Only read commands are ever run, with `--no-ext-diff --no-textconv`, no pager, no prompts, no system config.
- **Sandboxed to folders you choose.** `--root` (repeatable). Symlinks are resolved, so a link pointing outside the root is refused.
- **Injection-proof arguments.** Refs and dates cannot start with `-`; paths go after `--` and must stay inside the repo; free-text filters use the attached `--author=…` form.
- **Credentials redacted** from remote URLs.
- Uses your installed `git`. No native dependencies. Node.js 22+.

## Quick start

```json
{
  "mcpServers": {
    "git": { "command": "npx", "args": ["-y", "@aranshayan/mcp-git-insights", "--root", "/path/to/your/projects"] }
  }
}
```

Claude Code: `claude mcp add git -- npx -y @aranshayan/mcp-git-insights --root "$PWD"`

## Tools

| Tool | Description |
| --- | --- |
| `repo_summary` | Branch, HEAD, tracking, dirty file count, remotes, recent commits, top contributors. |
| `git_log` | Commits filtered by ref/range, path (with `follow`), author, dates, message text. |
| `git_show` | One commit with stats and patch (size-capped). |
| `git_diff` | Between two revisions or working tree; `stat_only` for overview. |
| `git_blame` | Per-line author/date/commit for up to 200 lines. |
| `changelog` | Release notes grouped by Conventional Commit type, breaking changes first. |

All tools are annotated `readOnlyHint`. Commit messages and file contents are untrusted input for the model.

## Tests

`npm test` builds throw-away repositories and checks every tool, option-injection attempts (`--output=…`), path traversal, symlink escape, non-repos, and the built CLI over stdio.

## License

[MIT](LICENSE)
