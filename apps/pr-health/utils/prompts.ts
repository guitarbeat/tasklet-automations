/**
 * Agent task prompts for the PR Health Dashboard.
 *
 * House rules for every prompt in this file:
 *   - one repo, one PR, one intent, one mutation, one explicit success condition
 *   - name the mutation exactly, and say what to do when it fails
 *   - never ask the agent to reopen the Dashboard; the Dashboard is already
 *     open when the button is pressed and reloads its own data afterwards
 *
 * Vocabulary follows CONTEXT.md: Stale PR, Jules Pipeline, Queue, Ping, Dashboard.
 */

/** Hard cap on pings per PR, matching the Jules Pipeline rules in DESIGN.md. */
export const MAX_PINGS = 3;

/**
 * Weekly caretaker pass. This is the one prompt that spans repos, because the
 * caretaker task files already define the sequence and its hard rules, so the
 * prompt delegates to them instead of restating the work.
 */
export function runCaretakerPrompt(): string {
  return [
    'Run the repo-caretaker weekly pass.',
    'Use /tasklet/agent/home/subagents/repo-caretaker.md as contextFiles and follow the task files in agent/caretaker/tasks in this order: scan, merge-bot-prs, issue-hygiene, queue-sync, alert.',
    'Hard rule: only the scan task gathers facts. Every later task reads state/pr-scan.json and must never re-scan or open GitHub to confirm counts.',
    'Success condition: state/pr-scan.json is refreshed and each of the four later tasks reports its own counts.',
    'Reply with one short summary of what actually changed.',
  ].join(' ');
}

/** Activate one stale PR in the Jules Pipeline: exactly one rebase ping. */
export function activatePRPrompt(repo: string, prNumber: number): string {
  return [
    `Activate stale PR #${prNumber} in ${repo} in the Jules Pipeline.`,
    'Scope: this one PR in this one repo. Do not touch any other PR.',
    `Mutation: post exactly one @jules comment on ${repo}#${prNumber} asking Jules to rebase it onto its base branch.`,
    `Bookkeeping, only after that comment posts: set the jules_queue row for pr_number=${prNumber} and repo='${repo}' to state 'active', with first_pinged_at and last_pinged_at set to now and ping_count 1, then insert one jules_activity_log row with action 'activated'.`,
    `Success condition: one new @jules comment exists on ${repo}#${prNumber} and its jules_queue row reads state 'active'.`,
    'If the comment does not post, change nothing in the database and say so.',
  ].join(' ');
}

/** Read-only status check on the active PR. No GitHub mutation at all. */
export function checkStatusPrompt(repo: string, prNumber: number): string {
  return [
    `Check the status of active PR #${prNumber} in ${repo}.`,
    'Scope: this one PR, read-only on GitHub. Do not comment, ping, merge, close, or reopen anything.',
    'Read its open/closed state, merged flag, mergeable flag, head commit date, and any comments posted after the last @jules ping.',
    `Bookkeeping: update the jules_queue row for pr_number=${prNumber} and repo='${repo}' to match what you found, and insert one jules_activity_log row with action 'status-check' and your finding in details.`,
    'Success condition: you state plainly what changed on the PR since the last ping, and the jules_queue row matches that statement.',
    'If GitHub cannot be read, change nothing in the database and say so.',
  ].join(' ');
}

/** Ping Jules again on the active PR: exactly one comment, guarded by the cap. */
export function pingJulesPrompt(repo: string, prNumber: number, pingCount: number): string {
  return [
    `Ping Jules again on active PR #${prNumber} in ${repo}.`,
    'Scope: this one PR. Do not ping any other PR.',
    `Preconditions: the PR is still open, and its jules_queue ping_count is ${pingCount}, which must be below ${MAX_PINGS}. If either precondition fails, post nothing and say why.`,
    `Mutation: post exactly one @jules comment on ${repo}#${prNumber} asking for a status update on the rebase.`,
    `Bookkeeping, only after that comment posts: set ping_count to ${pingCount + 1} and last_pinged_at to now on the jules_queue row for pr_number=${prNumber} and repo='${repo}', then insert one jules_activity_log row with action 'ping'.`,
    `Success condition: one new @jules comment exists on ${repo}#${prNumber} and its ping_count reads ${pingCount + 1}.`,
    'If the comment does not post, change nothing in the database and say so.',
  ].join(' ');
}

/** Close one dead PR, advisory comment first. */
export function autoClosePrompt(repo: string, prNumber: number, idleDays: number): string {
  return [
    `Close dead PR #${prNumber} in ${repo}, which has had no activity for ${idleDays} days.`,
    'Scope: this one PR. Do not close any other PR.',
    `Mutation, in this order: post exactly one comment on ${repo}#${prNumber} saying it is being closed for inactivity and can be reopened at any time, then close the PR.`,
    `Bookkeeping, only after the PR is closed: if a jules_queue row exists for pr_number=${prNumber} and repo='${repo}', set state 'resolved', resolution 'dead-${idleDays}d' and resolved_at to now, then insert one jules_activity_log row with action 'auto-closed'.`,
    `Success condition: ${repo}#${prNumber} is closed and carries the advisory comment.`,
    'If the comment does not post, do not close the PR and change nothing in the database.',
  ].join(' ');
}
