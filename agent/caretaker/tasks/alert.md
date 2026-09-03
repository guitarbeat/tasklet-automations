# Task: Alert

**Verb:** notify. At most ONE email to 2@alw.lol.

## Input

`state/pr-scan.json` + any of merge-log/issue-log that exist.

## Send only if at least one is true

- `token.canWrite` is false (work is blocked)
- `discrepancies` is non-empty (scan self-check disagreed)
- a merge attempt returned a non-200
- a PR is classified 'dead' (>90 days idle)

If none are true, send NOTHING. A silent successful run is the correct outcome.

## Hard rule — this is the guardrail that failed before

Every number in the email must be copied from a JSON artifact. Before writing a
count, name the file and key it came from. If you cannot, omit the claim.
Never describe a CLOSED PR as an active problem — check `state` first.
Never report "N untracked PRs" without listing their numbers.
