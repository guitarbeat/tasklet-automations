# tasklet-automations

Monorepo for Tasklet automation tooling — keeping GitHub repos clean and PRs healthy.

## Structure

```
├── apps/pr-health/      # PR Health Dashboard (Tasklet instant app)
├── workflows/           # GitHub Actions workflows
│   ├── stale-pr-rebase.yml   # Auto-rebase stale PRs via Jules
│   └── rebase_stale_prs.py   # Python script for staleness detection
└── subagents/           # Tasklet subagent instruction files
    ├── jules-rebase-stale-prs.md
    ├── build-pr-dashboard.md
    ├── delete-jules-sessions.md
    └── post-jules-update-comments.md
```

## PR Health Dashboard

A session-focused mission control dashboard for monitoring the Jules rebase pipeline. Tracks active sessions, queued PRs, and resolution history across multiple repos.

**Features:**
- Live PR data from GitHub API
- Jules pipeline status (scan → queue → activate → monitor → resolve)
- Agent-integrated actions (run scans, activate PRs, check status, re-ping Jules)
- Activity log with full audit trail

## Jules Rebase Pipeline

Automated sequential pipeline that:
1. Scans repos for stale PRs (behind `main`)
2. Queues them by priority
3. Activates one at a time, posting `@jules` comments
4. Monitors for resolution (merged/closed/failed)
5. Moves to the next PR in the queue

## Workflows

GitHub Actions workflow + Python script for CI-based stale PR detection and auto-rebase via Jules.

---

Built with [Tasklet AI](https://tasklet.ai)
