# tasklet-automations

Monorepo for Tasklet automation tooling — keeping GitHub repos clean and PRs healthy.

## Structure

```
tasklet-automations/
├── .agents/                        # AI agent instructions
│   └── tasklet/                    # Tasklet subagent definitions
│       ├── jules-rebase-stale-prs.md
│       ├── build-pr-dashboard.md
│       ├── delete-jules-sessions.md
│       ├── post-jules-update-comments.md
│       └── sync-repo.md
├── .github/
│   ├── workflows/
│   │   └── stale-pr-rebase.yml     # Weekly CI: detect & rebase stale PRs
│   └── scripts/
│       └── rebase_stale_prs.py     # Staleness detection + Jules integration
├── apps/
│   └── pr-health/                  # PR Health Dashboard (Tasklet instant app)
│       ├── app.tsx                 # Main application
│       ├── types.ts                # TypeScript types
│       ├── styles.css              # Custom animations
│       └── utils/helpers.ts        # Utility functions
├── packages/                       # Shared code (future)
├── package.json                    # Root workspace config
├── pnpm-workspace.yaml             # pnpm workspace definition
├── .editorconfig
└── .gitignore
```

## Apps

### PR Health Dashboard (`apps/pr-health`)

Session-focused mission control for monitoring the Jules rebase pipeline.

- **Live PR data** from GitHub API — no stale cache
- **Jules pipeline stepper** — scan → queue → activate → monitor → resolve
- **Agent-integrated actions** — run scans, activate PRs, check status, re-ping Jules
- **Activity log** with full audit trail
- **Queue management** — prioritize, resolve, fail items directly from UI

## Workflows

### Stale PR Rebase (`.github/workflows/stale-pr-rebase.yml`)

GitHub Actions workflow that runs weekly to:
1. Detect PRs behind the default branch (anchored SHA comparison)
2. Create Jules sessions or post `@jules` comments to trigger rebases
3. Supports dry-run mode and manual dispatch

## Agents

Tasklet subagent instructions in `.agents/tasklet/` power the automated pipeline:

| Agent | What it does |
|-------|-------------|
| **jules-rebase-stale-prs** | Core pipeline — scan repos, queue stale PRs, ping Jules sequentially |
| **build-pr-dashboard** | Rebuild the dashboard instant app |
| **delete-jules-sessions** | Bulk-delete Jules API sessions |
| **post-jules-update-comments** | Post `@jules` rebase comments on PRs |
| **sync-repo** | Bidirectional sync between Tasklet and this repo |

## Development

```bash
pnpm install
pnpm format:check
pnpm lint
```

---

Built with [Tasklet AI](https://tasklet.ai)
