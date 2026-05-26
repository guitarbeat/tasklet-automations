# .agents

AI agent instruction files used by automation platforms.

## Tasklet

Subagent instructions for [Tasklet AI](https://tasklet.ai) — each `.md` file defines a reusable worker that handles a specific task.

| Agent | Purpose |
|-------|--------|
| `jules-rebase-stale-prs.md` | Sequential Jules pipeline — scan, queue, ping, monitor, resolve |
| `build-pr-dashboard.md` | Rebuild the PR Health Dashboard instant app |
| `delete-jules-sessions.md` | Bulk-delete Jules API sessions |
| `post-jules-update-comments.md` | Post `@jules` comments on GitHub PRs |
| `sync-repo.md` | Bidirectional sync between Tasklet filesystem and this repo |
