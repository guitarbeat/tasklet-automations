-- Insert untracked open tasklet-automations PRs as queued (INSERT OR IGNORE keeps existing rows intact)
INSERT OR IGNORE INTO jules_queue (pr_number, repo, state, priority, notes) VALUES
 (1,  'guitarbeat/tasklet-automations', 'queued', 0, 'Dependabot: actions/checkout 4->6. mergeable=true, state=unstable (non-required checks failing). SAFE-TO-MERGE (squash) — READY BUT BLOCKED ON WRITE SCOPE (token read-only).'),
 (2,  'guitarbeat/tasklet-automations', 'queued', 0, 'Dependabot: pnpm/action-setup 4->6. mergeable=false, state=dirty (merge conflict). HOLD — needs human conflict resolution.'),
 (3,  'guitarbeat/tasklet-automations', 'queued', 0, 'Dependabot: actions/setup-python 5->6. mergeable=true, state=unstable (non-required checks failing). SAFE-TO-MERGE (squash) — READY BUT BLOCKED ON WRITE SCOPE.'),
 (4,  'guitarbeat/tasklet-automations', 'queued', 0, 'Dependabot: actions/setup-node 4->6. mergeable=true, state=unstable (non-required checks failing). SAFE-TO-MERGE (squash) — READY BUT BLOCKED ON WRITE SCOPE.'),
 (5,  'guitarbeat/tasklet-automations', 'queued', 0, 'Dependabot: typescript 5.9.3->7.0.2 (dev-tools). Major bump, quality check failing. HOLD — needs human review.'),
 (7,  'guitarbeat/tasklet-automations', 'queued', 0, 'Dependabot: actions/labeler 5->6. Major, config-format sensitive, Lint&TypeCheck failing. HOLD — needs human review.'),
 (15, 'guitarbeat/tasklet-automations', 'queued', 0, 'Human PR (@guitarbeat): ci reliability & security. NEVER auto-merge. HOLD — awaiting human merge (title-lint & quality checks failing).'),
 (20, 'guitarbeat/tasklet-automations', 'queued', 0, 'Dependabot: lucide-react 0.523.0->1.31.0 (runtime dep). Major bump though checks clean/mergeable. HOLD — runtime major, needs human review.');

INSERT INTO jules_activity_log (action, details) VALUES
 ('caretaker-run', 'Weekly pass (electron + tasklet-automations). electron: 0 open PRs/0 issues. automations: 8 open PRs (7 Dependabot + human #15), 0 real issues. SAFE-to-merge: #1,#3,#4. HOLD: #2(dirty),#5(ts major),#7(labeler major),#15(human),#20(lucide major). All merges READY BUT BLOCKED — token confirmed read-only (403). Added 8 untracked PRs to queue as queued. No email needed for now (write-scope blocker is a known standing issue).');
