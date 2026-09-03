# Task: Scan

**Verb:** inventory. Changes nothing.

## Do

Run exactly this, nothing else:
`cd /tasklet/agent/home/scripts/caretaker && bun scan.ts`

## Output

Writes `/tasklet/agent/home/state/pr-scan.json`.

## Hard rule

You are forbidden from stating any count not present in `pr-scan.json`.
Do NOT open GitHub to "confirm" a number — the script already cross-checks the
pulls list against the search API and sets `countVerified: false` if they diverge.
If a number is not in the file, the answer is "not measured", not a guess.
