# Repo caretaker

Small, single-purpose tasks. Each has **one verb, one input, one output**.

Run order:

1. `tasks/scan.md` — deterministic inventory. Writes `state/pr-scan.json`.
   The only task allowed to gather facts.
2. `tasks/merge-bot-prs.md` — merge safe bot PRs.
3. `tasks/issue-hygiene.md` — comment/close stale issues.
4. `tasks/queue-sync.md` — reconcile the `jules_queue` table.
5. `tasks/alert.md` — at most one notification email.

Tasks 2-5 **read** `state/pr-scan.json` and must never re-scan.

## Why split up

An earlier single monolithic prompt hallucinated counts - it reported 30
"untracked" PRs by counting closed ones, and flagged an already-closed PR
as a live conflict. Facts now come from `scripts/scan.ts`, which
cross-checks two API sources and sets `countVerified`. The language model
only makes judgement calls, never counts.
