INSERT INTO jules_queue (pr_number, repo, state, priority, notes, created_at, updated_at)
VALUES (617, 'guitarbeat/electron', 'queued', 0,
  'Jules PR (human-authored @guitarbeat, branch jules-*): security fix rate-limiting IP spoofing (api/omdb.ts). Fresh, review PENDING (bot comments only). Not a trusted-bot auto-merge candidate; awaiting human review/merge. Merge blocked this run (no token).',
  datetime('now'), datetime('now'))
ON CONFLICT(pr_number, repo) DO UPDATE SET updated_at=datetime('now');

INSERT INTO jules_queue (pr_number, repo, state, priority, notes, created_at, updated_at)
VALUES (616, 'guitarbeat/electron', 'queued', 0,
  'Jules PR (human-authored @guitarbeat, branch jules-*): remove noisy console.warn in useMovies hook. Fresh, review PENDING (bot comments only). Not a trusted-bot auto-merge candidate; awaiting human review/merge. Merge blocked this run (no token).',
  datetime('now'), datetime('now'))
ON CONFLICT(pr_number, repo) DO UPDATE SET updated_at=datetime('now');

INSERT INTO jules_activity_log (pr_number, repo, action, details)
VALUES (617, 'guitarbeat/electron', 'pr-queued', 'Queued fresh Jules PR #617 (security fix). Human-authored; not auto-merged. Merge blocked (no token).');

INSERT INTO jules_activity_log (pr_number, repo, action, details)
VALUES (616, 'guitarbeat/electron', 'pr-queued', 'Queued fresh Jules PR #616 (console warning cleanup). Human-authored; not auto-merged. Merge blocked (no token).');

INSERT INTO jules_activity_log (repo, action, details)
VALUES (NULL, 'caretaker-run', 'Weekly run. Scanned guitarbeat/electron (2 open PRs #616,#617 - both fresh, human-authored Jules PRs, queued) + guitarbeat/automation-hub (0 open PRs, 0 issues). No trusted-bot PRs to auto-merge. No issue duplicates/unattended. Merge/write BLOCKED (no token, PAT revoked 401). No email sent (nothing actionable beyond known token block).');
