# PR Health Dashboard Builder

Build a significantly upgraded PR Health Dashboard instant app at `/agent/home/apps/pr-health/`.

## CRITICAL: Read the skill file first

You MUST read `/agent/skills/system/building-instant-apps/SKILL.md` before writing ANY code. Follow all its rules exactly.

## Context

The app fetches data from:
1. GitHub PRs via `conn_8et0d5bx3yszdanafpnb__github_list_pull_requests` for repos `guitarbeat/bledsoe-mobile-notary` and `guitarbeat/PhD-Writing`
2. Jules sessions via SQL: `SELECT id, pr_number, repo, session_id, created_at, status, result_pr_url FROM jules_sessions ORDER BY created_at DESC`

The GitHub tool returns objects like:
```json
{
  "number": 273,
  "title": "🎨 Palette: [UX improvement] Add aria-expanded...",
  "state": "open",
  "user": "guitarbeat",
  "head": { "ref": "palette/a11y-...", "sha": "..." },
  "base": { "ref": "main", "sha": "785ab43..." },
  "createdAt": "2026-04-15T20:10:23Z",
  "updatedAt": "2026-04-15T20:12:29Z"
}
```

## Architecture

Keep the existing multi-file structure:
- `app.tsx` — main shell, data fetching, routing
- `types.ts` — all type definitions
- `utils/helpers.ts` — utility functions
- `components/StatsCards.tsx` — top stat cards
- `components/PRTable.tsx` — PR table with filters
- `components/JulesActivity.tsx` — Jules session log
- `components/RepoBreakdown.tsx` — per-repo health cards

You may add new component files if needed.

## What to Improve

### 1. Agent Type Detection
Parse PR titles to detect agent types:
- Title contains "🛡️" or "Sentinel" → type "sentinel"
- Title contains "⚡" or "Bolt" → type "bolt"
- Title contains "🎨" or "Palette" → type "palette"
- Otherwise → type "other"

Add `agentType` to PullRequest type. Show colored badges for each agent type throughout the app.

### 2. Interactive Overview Tab
- Stat cards should be CLICKABLE — clicking "Stale" filters the PR table and switches to PRs tab
- Add an agent type breakdown section showing count per agent type with colored bars
- Add an age distribution visualization: group PRs into buckets (< 1 day, 1-7 days, 7-30 days, 30-90 days, 90+ days) and show as horizontal stacked bar
- Health score per repo: percentage of PRs that are current (show as a radial/ring gauge or large percentage)

### 3. Richer Repo Breakdown Cards
- Show agent type distribution within each repo (mini colored bar)
- Show oldest and newest PR info
- Show number of Jules pings for that repo
- Add a "dead PRs" count with skull icon

### 4. Better PR Table
- Add agent type column with colored emoji badges
- Make the title column show the agent emoji prefix prominently
- Add a tooltip or expandable row showing the branch name
- Add agent type filter dropdown alongside the existing filters
- Highlight rows that are "dead" with a subtle red background

### 5. Enhanced Jules Activity
- Group sessions by week with section headers ("This week", "Last week", "2 weeks ago", etc.)
- Add summary stats at top: total pings, unique PRs pinged, repos covered, re-pings count
- Color-code rows by action type (ping = blue, re-ping = yellow, auto-close = red)

### 6. Visual Polish
- Use a header bar with the title "PR Health" and a subtle gradient or accent
- Use `stats` style cards with a slight shadow/border for depth
- Add smooth transitions when switching tabs
- Use DaisyUI's `badge` variants more creatively
- Empty states should have helpful icons and messages
- Show a "last updated" relative time (e.g., "2 min ago") near the refresh button

### Design Constraints
- Use DaisyUI components and Tailwind classes ONLY (no external chart libraries)
- All visualizations must be built with divs/CSS (bar charts, ring gauges, etc.)
- Keep it performant — use useMemo for expensive computations
- Mobile-friendly: cards should stack on small screens
- Use lucide-react for all icons

## Writing the Code

1. First read the skill file at `/agent/skills/system/building-instant-apps/SKILL.md`
2. Write each file completely (don't edit, use write op)
3. Write files in dependency order: types → helpers → components → app.tsx
4. Do NOT call show_user_preview — the parent agent will do that
5. Report what you built in your final message
