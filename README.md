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

## Limits

- **Output size & query caps:**
  - Every `git` invocation runs with a **20-second timeout** and an **8 MiB stdout buffer cap** (`src/git.ts`). If stdout hits the 8 MiB buffer cap, the output captured up to that point is returned; if a command exceeds 20 seconds, it fails with a timeout error.
  - `git_show` and `git_diff` truncate output at **`max_chars`** (default `30,000`, maximum `200,000`, minimum `1,000`) with a trailing truncation notice. Use `path` or `stat_only: true` to narrow large diffs.
  - `git_log` caps results at **`limit`** (default `30`, maximum `200`), and `author` / `grep` filters are capped at `200` characters.
  - `git_blame` returns at most **200 lines per call** (default `50` lines when `end_line` is omitted).
- **Very large repositories:** `repo_summary` runs `git rev-list --count HEAD` and `git shortlog -sn --no-merges HEAD` across full reachable history, and `changelog` walks the entire `from..to` range without a commit cap. On very large monorepos these commands may hit the 20-second timeout or 8 MiB stdout buffer limit; prefer scoped `git_log` / `git_diff` calls with `path`, `since`, or narrower revision ranges.
- **Shallow clones:** Tools only see commits present in the local clone. `repo_summary` commit/contributor counts, `git_log`, `git_blame`, and `changelog` stop at the shallow graft boundary, and referencing commits or tags outside the fetched depth fails with a Git error.
- **Submodules:** Submodule directories are not traversed automatically — `git_diff` and `git_show` in the superproject report only the gitlink commit hash change. To inspect a submodule's own history, pass the submodule's directory as `repo` (it must lie inside an allowed `--root`).
- **Binary files in `git_show` and `git_diff`:** Both tools pass `--no-ext-diff` and `--no-textconv`, so binary files are never converted by external helpers or dumped as raw bytes; Git prints its standard `Binary files … differ` summary line instead.

## Tests

`npm test` builds throw-away repositories and checks every tool, option-injection attempts (`--output=…`), path traversal, symlink escape, non-repos, and the built CLI over stdio.

## License

[MIT](LICENSE)
