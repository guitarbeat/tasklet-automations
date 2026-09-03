# Task: Merge safe bot PRs

**Verb:** merge. Reads `state/pr-scan.json`. Never re-scans.

## Preconditions

Stop immediately if `token.canWrite` is false. Report "blocked: read-only token".

## Eligibility (ALL must hold)

- `isBot: true`
- `mergeable: true` AND `mergeableState` is "clean"
- NOT a major version bump (0.x->1.x, 5->6, 5->7 are majors: HOLD)
- All check runs conclusion success/skipped/neutral — no failures

## CRITICAL: stale vs real failure

A failing check is only real if its `started_at` is NEWER than the last commit to
`.github/workflows/`. A failure from before a workflow fix is STALE — the PR is
not broken, its CI simply never re-ran. Do not close or hold these; update the
branch (`@dependabot rebase`) to re-run CI, then re-evaluate.

## Do

`PUT /repos/{owner}/{repo}/pulls/{n}/merge` with `merge_method: "squash"`.
One PR at a time. On non-200, stop and report; do not retry blindly.

## Output

`state/merge-log.json`: per PR — number, action taken, HTTP status, reason.
