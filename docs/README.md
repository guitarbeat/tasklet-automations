# Documentation

## Contents

| Document | What it covers |
|----------|---------------|
| [DESIGN.md](../DESIGN.md) | Architecture, design decisions, component patterns |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Development setup and contribution guide |
| [AI_RULES.md](../AI_RULES.md) | Tech stack and coding rules for AI assistants |
| [CONTEXT.md](../CONTEXT.md) | Project context and glossary |
| [SECURITY.md](../SECURITY.md) | Security policy and vulnerability reporting |
| [CHANGELOG.md](../CHANGELOG.md) | Full change history |

## Pipeline Evolutions

| # | Evolution | Status |
|---|-----------|--------|
| 1 | Smarter staleness detection (anchored SHA) | Complete |
| 2 | Jules follow-up loop (re-ping persistent stale) | Complete |
| 3 | Auto-close dead PRs >90 days (advisory comments) | Complete |
| 4 | GitHub Actions CI | Blocked on permissions |
| 5 | PR Health Dashboard (live, agent-integrated) | Complete |

## Database Schema

### `jules_queue`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `pr_number` | INTEGER | GitHub PR number |
| `repo` | TEXT | Full repo name (e.g., `guitarbeat/PhD-Writing`) |
| `state` | TEXT | `queued`, `active`, `resolved`, `failed` |
| `priority` | INTEGER | Higher = more urgent |
| `jules_comment_id` | INTEGER | GitHub comment ID of @jules ping |
| `ping_count` | INTEGER | Number of times Jules was pinged |
| `first_pinged_at` | TEXT | Timestamp of first ping |
| `last_pinged_at` | TEXT | Timestamp of most recent ping |
| `resolved_at` | TEXT | When the item was resolved |
| `notes` | TEXT | Free-form notes |
| `resolution` | TEXT | How it was resolved |
| `created_at` | TEXT | Row creation time |
| `updated_at` | TEXT | Last update time |

### `jules_activity_log`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `queue_item_id` | INTEGER | FK to jules_queue.id |
| `pr_number` | INTEGER | GitHub PR number |
| `repo` | TEXT | Full repo name |
| `actor` | TEXT | Who performed the action |
| `action` | TEXT | Action type (scan, ping, resolve, etc.) |
| `detail` | TEXT | Human-readable detail |
| `details` | TEXT | Additional JSON details |
| `created_at` | TEXT | Timestamp |
