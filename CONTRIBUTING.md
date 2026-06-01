# Contributing to tasklet-automations

Thanks for your interest! This guide covers the monorepo structure and development workflow.

## Repository Layout

| Path | What |
|------|------|
| `apps/pr-health/` | PR Health Dashboard (Tasklet instant app) |
| `packages/` | Shared code and utilities |
| `.agents/tasklet/` | Tasklet AI subagent instructions |
| `.github/workflows/` | CI + automation workflows |
| `.github/scripts/` | Supporting Python scripts |

## Development Setup

```bash
git clone https://github.com/guitarbeat/tasklet-automations.git
cd tasklet-automations
pnpm install
```

## Where to Make Changes

| Change | Location |
|--------|----------|
| Dashboard UI | `apps/pr-health/app.tsx` |
| Dashboard types | `apps/pr-health/types.ts` |
| Dashboard helpers | `apps/pr-health/utils/helpers.ts` |
| Animations | `apps/pr-health/styles.css` |
| Stale PR workflow | `.github/workflows/stale-pr-rebase.yml` |
| Staleness detection | `.github/scripts/rebase_stale_prs.py` |
| Agent instructions | `.agents/tasklet/*.md` |

## Code Quality

```bash
pnpm format:check    # check formatting
pnpm format          # auto-fix formatting
pnpm lint            # type-check
```

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(dashboard): add pipeline stepper component
fix(workflow): handle missing base SHA
docs: update agent README
chore: update dependencies
```

Scopes: `dashboard`, `workflow`, `agents`, `ci`, or omit for cross-cutting changes.

## Pull Request Checklist

- [ ] Type checks pass (`pnpm lint`)
- [ ] Code is formatted (`pnpm format:check`)
- [ ] README updated if public API changed
- [ ] Commits follow conventional format
- [ ] PR template filled out

## Architecture Notes

- **Monorepo** — pnpm workspaces with `apps/*` + `packages/*`
- **Tasklet runtime** — Dashboard is a Tasklet instant app (bundled at runtime, not locally)
- **Agent-integrated** — Dashboard buttons trigger Tasklet AI agent actions via `sendMessageToAgent`
- **Sequential pipeline** — Jules interactions are one-at-a-time, tracked in `jules_queue` DB table
