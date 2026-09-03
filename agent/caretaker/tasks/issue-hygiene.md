# Task: Issue hygiene

**Verb:** comment/close issues. Touches issues only, never PRs.

## Input

`state/pr-scan.json` -> `repos[].issues` and `repos[].duplicates`.
The duplicate groups are already computed. Do not re-derive them.

## Do

- For each duplicate group: comment on each `close` number linking the `keep`
  number, then close it.
- For each `unattended: true` issue (>30d, zero comments): add ONE nudge comment.
  Never close an unattended issue automatically.

## Hard rule

If `openIssueCount` is 0, do nothing and report "no issues". Do not go looking
for work that the scan did not find.

## Output

`state/issue-log.json`: issue number, action, result.
