# Task: Queue sync

**Verb:** reconcile the `jules_queue` DB table against the scan. DB only.

## Input

`state/pr-scan.json` = ground truth for what is OPEN.

## Do

1. Any `jules_queue` row in state 'queued'/'active' whose PR is NOT open in the
   scan: fetch that PR once, set resolution by its real fate —
   `merged=true` -> 'merged'; `state=closed, merged=false` -> 'closed'.
   Never assume merged; a closed-unmerged PR is a different outcome and matters.
2. Any open PR in the scan with no queue row: insert as 'queued'.

## Schema notes (verified)

- `jules_queue` uses `state`, not `status`. No `title` column.
- `jules_activity_log` uses `details`, and its FK needs a valid `queue_item_id`
  or NULL.

## Output

Counts only: rows updated, rows inserted. No prose speculation.
