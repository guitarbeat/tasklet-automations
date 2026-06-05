# Design

Architecture, design decisions, and patterns for the tasklet-automations monorepo.

## System Architecture

```
+-------------------+     +-------------------+     +-------------------+
|   GitHub API      |     |   Jules API       |     |   Tasklet AI      |
|  (PRs, repos)     |     |  (@jules ping)    |     |  (orchestrator)   |
+--------+----------+     +--------+----------+     +--------+----------+
         |                         |                          |
         +-----------+-------------+-----------+--------------+
                     |
          +----------+----------+
          |   Jules Pipeline    |
          |   (sequential)      |
          +----------+----------+
                     |
      +---------+----+----+---------+
      |         |         |         |
  +---+---+ +---+--+ +---+---+ +---+----+
  | Scan  | |Queue | | Ping  | |Resolve |
  +-------+ +------+ +-------+ +--------+
```

## Pipeline Flow

```
Weekly Cron (Mon 9 AM CT)
  |
  +-- Scan repos for open PRs
  |   +-- Compare each PR's base.sha against main HEAD
  |   +-- Flag stale (behind main) and dead (>90 days)
  |
  +-- Check active queue item
  |   +-- If merged/resolved -> mark done, archive session
  |   +-- If still in progress -> skip (wait for next week)
  |   +-- If failed (>7 days no response) -> mark failed
  |
  +-- Pick next stale PR from queue
  |   +-- Post @jules comment on GitHub PR
  |   +-- Set as active in jules_queue
  |
  +-- Report to dashboard
```

## Key Design Decisions

### 1. Sequential Pipeline (not parallel)

**Decision:** Process one Jules conversation at a time.

**Why:** Jules works best with focused attention. Batch-pinging creates noise, races,
and makes it hard to track which conversations need follow-up. Sequential processing
gives clear accountability per PR.

### 2. Anchored SHA Comparison

**Decision:** Use the newest PR's `base.sha` as a reference for main HEAD, rather than
fetching the branch ref directly.

**Why:** The GitHub integration doesn't expose `mergeable_state`. Comparing each PR's
`base.sha` against the latest known main HEAD reliably detects staleness.

### 3. Single-File Dashboard

**Decision:** All React components live in `app.tsx`. No component splitting.

**Why:** Tasklet instant apps are bundled at runtime. A single file simplifies the
build, avoids import resolution issues, and keeps the full UI context visible. At ~950
lines, it's manageable as one file.

### 4. Agent-Integrated UI

**Decision:** Dashboard buttons send messages to the Tasklet AI agent via
`sendMessageToAgent()`, which executes real actions (post @jules comments, scan repos,
update queue).

**Why:** The dashboard is a mission control, not a passive display. Users should be
able to trigger pipeline actions directly from the UI without switching contexts.

### 5. Database as Source of Truth

**Decision:** `jules_queue` table is the single source of truth for pipeline state.

**Why:** GitHub PR data is live (always fresh), but pipeline state (who's active,
what's been pinged, what's resolved) needs persistence. The queue table tracks this
with clear states: `queued`, `active`, `resolved`, `failed`.

### 6. @jules Comment Mentions

**Decision:** Trigger Jules via `@jules` comments on PRs, not the Jules API directly.

**Why:** The Jules API doesn't support session creation with API key auth. Comment
mentions are the only reliable trigger mechanism and leave a visible audit trail on
the PR.

## Dashboard Architecture

```
PR Health Dashboard (app.tsx)
|
+-- Stats Bar --------- Live PR counts, queue stats, pipeline state
+-- Pipeline Stepper --- Visual: Scan > Queue > Activate > Monitor > Resolve
+-- Active Session ----- Current Jules conversation with status + actions
+-- Queue Table -------- Pending PRs sorted by priority
+-- Next Action -------- CTA for what the pipeline should do next
+-- Activity Log ------- Full audit trail of pipeline actions
```

### Data Sources

| Data | Source | Freshness |
|------|--------|-----------|
| Open PRs | GitHub API (`github_list_pull_requests`) | Live on load |
| Queue state | SQLite (`jules_queue`) | Live on load |
| Activity log | SQLite (`jules_activity_log`) | Live on load |
| Pipeline step | Computed from queue + PR data | Derived |

### Agent Action Flow

```
User clicks bot button in dashboard
  -> sendMessageToAgent("Run a full stale PR scan...")
  -> Tasklet agent receives message
  -> Agent runs subagent or direct tool calls
  -> Database updated + GitHub comments posted
  -> Dashboard auto-refreshes on next load
```
