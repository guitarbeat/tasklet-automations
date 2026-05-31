# tasklet-automations

[![CI](https://github.com/guitarbeat/tasklet-automations/actions/workflows/ci.yml/badge.svg)](https://github.com/guitarbeat/tasklet-automations/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Monorepo for Tasklet automation tooling — keeping GitHub repos clean and PRs healthy.

## Structure

```
tasklet-automations/
├── apps/
│   └── pr-health/                  # PR Health Dashboard (Tasklet instant app)
│       ├── app.tsx                 # Session-focused mission control
│       ├── types.ts                # TypeScript types
│       ├── styles.css              # Custom animations
│       └── utils/helpers.ts        # Utility functions
├── packages/                       # Shared code (future workspaces)
├── .agents/
│   └── tasklet/                    # Tasklet subagent definitions
│       ├── jules-rebase-stale-prs.md   # Core rebase pipeline
│       ├── build-pr-dashboard.md       # Dashboard builder
│       ├── delete-jules-sessions.md    # Session cleanup
│       ├── post-jules-update-comments.md # PR comment poster
│       └── sync-repo.md               # Bidirectional sync
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                  # Lint & type-check on push/PR
│   │   └── stale-pr-rebase.yml     # Weekly stale PR detection
│   ├── scripts/
│   │   └── rebase_stale_prs.py     # Staleness detection + Jules
│   ├── ISSUE_TEMPLATE/             # Bug report & feature request forms
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── CODEOWNERS
│   ├── dependabot.yml              # Auto-update deps (npm, pip, actions)
│   └── labeler.yml                 # Auto-label PRs by path
├── package.json                    # Root workspace config
├── pnpm-workspace.yaml
├── tsconfig.json                   # Root TypeScript config
├── .prettierrc                     # Code formatting
├── .editorconfig
└── .gitignore
```

## Apps

### PR Health Dashboard · `apps/pr-health`

Session-focused mission control for monitoring the Jules rebase pipeline.

- **Live PR data** from GitHub API — no stale cache
- **Jules pipeline stepper** — scan → queue → activate → monitor → resolve
- **Agent-integrated actions** — run scans, activate PRs, check status, re-ping Jules
- **Activity log** with full audit trail
- **Queue management** — prioritize, resolve, fail items directly from UI

## Workflows

### Stale PR Rebase · `.github/workflows/stale-pr-rebase.yml`

GitHub Actions workflow that runs weekly to:

1. Detect PRs behind the default branch (anchored SHA comparison)
2. Post `@jules` comments to trigger rebases
3. Supports dry-run mode and manual dispatch

## Agents

Tasklet subagent instructions in `.agents/tasklet/` power the automated pipeline:

| Agent | Purpose |
| ----- | ------- |
| `jules-rebase-stale-prs` | Core pipeline — scan, queue, ping Jules sequentially |
| `build-pr-dashboard` | Rebuild the dashboard instant app |
| `delete-jules-sessions` | Bulk-delete Jules API sessions |
| `post-jules-update-comments` | Post `@jules` rebase comments on PRs |
| `sync-repo` | Bidirectional sync between Tasklet and this repo |

## Development

```bash
pnpm install
pnpm format:check
pnpm lint
```

## Combining with other monorepos

This repo follows the same conventions as other `@guitarbeat` monorepos:

- **`pnpm-workspace.yaml`** — `apps/*` + `packages/*` workspaces
- **`.agents/`** — AI agent instructions (matches Naming-Nosferatu)
- **`.github/`** — workflows, templates, CODEOWNERS, dependabot, labeler
- **Root configs** — `tsconfig.json`, `.prettierrc`, `.editorconfig`

To merge, copy the `apps/pr-health/` directory and add the workspace to `pnpm-workspace.yaml`. Agent instructions go in `.agents/tasklet/`, workflows in `.github/workflows/`.

---

Built with [Tasklet AI](https://tasklet.ai)
