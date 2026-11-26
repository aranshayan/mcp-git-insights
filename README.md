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

- **Time and size per call.** Each git command is stopped after 20 seconds. Output is read up to 8 MB; past that it is cut off without a note, so on very large repositories narrow `git_log` and `changelog` with a path, a ref range or dates.
- **Patches are capped.** `git_show` and `git_diff` return at most `max_chars` (30,000 by default, 200,000 at most) and say so when they cut. `git_log` returns at most 200 commits per call, `git_blame` at most 200 lines.
- **Binary files** are not shown. Diffs only report that they changed, because external diff and textconv drivers are turned off on purpose.
- **Submodules** are not entered. A diff shows the submodule's old and new commit, and other tools see only the parent repository.
- **Shallow clones** only have the history that was fetched. `git_log`, `git_blame` and `changelog` stop at the shallow boundary, so release notes from an older tag can be incomplete or fail to find the tag.
- **`changelog`** relies on Conventional Commit prefixes (`feat:`, `fix:` ...). Commits without one are listed under "Other changes", and merge commits are skipped.

## Tests

`npm test` builds throw-away repositories and checks every tool, option-injection attempts (`--output=…`), path traversal, symlink escape, non-repos, and the built CLI over stdio.

## License

[MIT](LICENSE)
