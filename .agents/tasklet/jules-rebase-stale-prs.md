# Jules Rebase — Focused Sequential Pipeline

Works ONE PR at a time through Jules. Each trigger run either advances the active PR
toward resolution or picks the next one from the queue.

## Tools Available

- `conn_8et0d5bx3yszdanafpnb__github_list_pull_requests` — list PRs
- `conn_8et0d5bx3yszdanafpnb__github_get_pull_request` — get individual PR details
- `conn_8et0d5bx3yszdanafpnb__github_create_issue_comment` — post GitHub comments
- `conn_eefcc2t97c0bfqx78k4p__remote_http_call` — Jules API
- `run_agent_memory_sql` — read/write the database

## Repos

- `guitarbeat/bledsoe-mobile-notary`
- `guitarbeat/PhD-Writing`

---

## Database Tables

### `jules_queue` — the focused work queue

```sql
CREATE TABLE IF NOT EXISTS jules_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_number INTEGER NOT NULL,
  repo TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'queued',  -- queued | active | resolved | failed | skipped
  priority INTEGER NOT NULL DEFAULT 0,   -- sentinel=3, bolt=2, palette=1, other=0
  ping_count INTEGER NOT NULL DEFAULT 0,
  first_pinged_at TEXT,
  last_pinged_at TEXT,
  resolved_at TEXT,
  resolution TEXT,  -- merged | rebased | closed | manually-resolved | jules-failed
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pr_number, repo)
);
```

### `jules_sessions` — legacy ping log (read-only, for dashboard history)

Keep this for historical reference. Don't write new rows here.

---

## Instructions

### Step 1: Ensure DB Tables Exist

Run the `CREATE TABLE IF NOT EXISTS` for `jules_queue` (schema above).

### Step 2: Scan for Current Main HEAD SHA

For each repo, list open PRs with `readMask: ["branches", "dates", "user"]`, `per_page: 100`.

Get the most recently created PR's full details via `github_get_pull_request`.
Its `base.sha` = current main HEAD. Cross-check with 1–2 other recent PRs.

Store the main HEAD SHA per repo in a local variable.

### Step 3: Check the Active PR

Query for the currently active PR:

```sql
SELECT * FROM jules_queue WHERE state = 'active' LIMIT 1
```

**If there IS an active PR:**

1. Call `github_get_pull_request` on it to check its current status.

2. **Determine outcome:**
   - **PR is merged** (`merged` is true) → resolve as `merged`
   - **PR is closed** (`state` is "closed") → resolve as `closed`
   - **PR base SHA now matches main HEAD** → resolve as `rebased` (Jules succeeded!)
   - **PR base SHA still different AND `mergeable` is false** → resolve as `jules-failed` (conflicts Jules can't fix)
   - **PR base SHA still different AND ping_count >= 3** → resolve as `jules-failed` (3 attempts, no progress)
   - **PR base SHA still different AND ping_count < 3** → re-ping Jules (see Step 5)

3. **To resolve a PR:**

```sql
UPDATE jules_queue
SET state = ?, resolution = ?, resolved_at = datetime('now'), updated_at = datetime('now')
WHERE id = ?
```

Then proceed to Step 4 to pick the next PR.

4. **To re-ping:** Go directly to Step 5 with this PR.

**If there is NO active PR:** Proceed to Step 4.

### Step 4: Pick the Next PR from the Queue

First, refresh the queue — add any stale PRs not already tracked:

For each open PR across both repos:

- If its base SHA ≠ main HEAD SHA → it's stale
- Check if it's already in `jules_queue` (any state)
- If not → insert it with appropriate priority:
  - Title contains "sentinel" or 🛡️ → priority 3
  - Title contains "bolt" or ⚡ → priority 2
  - Title contains "palette" or 🎨 → priority 1
  - Otherwise → priority 0

Remove PRs from queue that are no longer stale (base SHA matches) and still in `queued` state:

```sql
DELETE FROM jules_queue WHERE state = 'queued' AND pr_number = ? AND repo = ?
```

Now pick the highest-priority queued PR:

```sql
SELECT * FROM jules_queue
WHERE state = 'queued'
ORDER BY priority DESC, created_at ASC
LIMIT 1
```

If no queued PRs → all caught up! Report that and stop.

Mark it active:

```sql
UPDATE jules_queue
SET state = 'active', updated_at = datetime('now')
WHERE id = ?
```

### Step 5: Ping Jules

Post a comment on the active PR via `github_create_issue_comment`:

**First ping (ping_count = 0):**

```
@jules Please rebase this branch onto the latest `main` and resolve any conflicts. Thanks!
```

**Re-ping (ping_count > 0):**

```
@jules This branch is still behind `main`. Could you please try rebasing again? (Attempt PING_COUNT/3)
```

Update the record:

```sql
UPDATE jules_queue
SET ping_count = ping_count + 1,
    first_pinged_at = COALESCE(first_pinged_at, datetime('now')),
    last_pinged_at = datetime('now'),
    updated_at = datetime('now')
WHERE id = ?
```

### Step 6: Check Jules API for Session Status (Bonus Context)

After pinging, optionally check the Jules API for any sessions related to the active PR's repo:

```
GET https://jules.googleapis.com/v1alpha/sessions?pageSize=20
```

Look for sessions mentioning the PR number in their title/description. If found, note the
session state in the `notes` column for dashboard visibility. This is informational only —
the GitHub PR state is the source of truth for resolution.

### Step 7: Auto-Close Dead PRs (Separate Pass)

After handling the active PR, do a quick scan for PRs with `updatedAt` > 90 days ago.

For each dead PR not already in the queue with resolution `closed`:

1. Post a comment:

```
🧹 This PR has had no activity for 90+ days. If this work is still needed, please reopen and rebase onto `main`.
```

2. Insert/update in queue:

```sql
INSERT OR REPLACE INTO jules_queue (pr_number, repo, state, resolution, resolved_at, notes, updated_at)
VALUES (?, ?, 'skipped', 'dead-90d', datetime('now'), 'Auto-close suggested', datetime('now'))
```

Only do this ONCE per PR — check before commenting:

```sql
SELECT id FROM jules_queue WHERE pr_number = ? AND repo = ? AND resolution = 'dead-90d'
```

### Step 8: Report Results

Return a summary:

- **Active PR**: which PR is currently being worked, ping count, status
- **Queue depth**: how many PRs remain queued by priority
- **Resolved this run**: any PRs that got resolved and how
- **Dead PRs flagged**: any auto-close comments posted
- **Overall progress**: total resolved / total ever queued

---

## Important Notes

- **ONE active PR at a time.** Never ping more than one PR per run.
- **3 pings max** before marking as failed — don't spam.
- **Resolution is based on GitHub state**, not Jules API. If the PR's base SHA matches main, it's resolved regardless of how.
- **Never ping conflicted PRs** (`mergeable` = false). Mark as `jules-failed` immediately.
- **The legacy `jules_sessions` table is read-only.** All new tracking goes in `jules_queue`.
- **Priority order**: Sentinel (security) > Bolt (perf) > Palette (UX) > Other
