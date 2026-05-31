# Agents

AI agent instruction files for [Tasklet AI](https://tasklet.ai) automation.

## Tasklet Subagents

| File | Description |
| ---- | ----------- |
| [`tasklet/jules-rebase-stale-prs.md`](tasklet/jules-rebase-stale-prs.md) | Core pipeline — scans repos for stale PRs, queues them, pings `@jules` sequentially |
| [`tasklet/build-pr-dashboard.md`](tasklet/build-pr-dashboard.md) | Rebuilds the PR Health Dashboard instant app |
| [`tasklet/delete-jules-sessions.md`](tasklet/delete-jules-sessions.md) | Bulk-deletes Jules API sessions |
| [`tasklet/post-jules-update-comments.md`](tasklet/post-jules-update-comments.md) | Posts `@jules` rebase comments on GitHub PRs |
| [`tasklet/sync-repo.md`](tasklet/sync-repo.md) | Bidirectional sync between Tasklet filesystem and this repo |

## Adding agents

Create a new `.md` file in `tasklet/` with the agent's instructions. The filename becomes the agent identifier.
