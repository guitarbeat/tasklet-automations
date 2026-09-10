import { invokeTool } from '@tasklet/tools/v2';

async function q(query: string) {
  const r = await invokeTool({ toolName: 'run_agent_memory_sql', args: { query } });
  if (!r.ok) throw new Error(r.error);
  return await r.json();
}

// Insert untracked open PR #687 (ImgBot) as queued
console.log(JSON.stringify(await q(`INSERT INTO jules_queue (pr_number, repo, state, priority, notes)
VALUES (687, 'guitarbeat/PhD-Writing', 'queued', 0,
  'ImgBot image optimization PR; routine bot PR, auto-merge blocked this run (merge PAT 401 Bad credentials)')
ON CONFLICT(pr_number, repo) DO NOTHING`)));

// Log caretaker run
console.log(JSON.stringify(await q(`INSERT INTO jules_activity_log (pr_number, repo, action, details)
VALUES (NULL, NULL, 'caretaker-run',
  'Weekly run: PhD-Writing 1 open PR (#687 ImgBot, Fresh, queued, auto-merge BLOCKED by merge-PAT 401); bledsoe 0 open PRs. Issues: 1 open (bledsoe #311 canonical, no new dups). Merges blocked pending PAT reauth. No email sent (silence=health).')`)));

// Verify
console.log('--- verify queue ---');
console.log(JSON.stringify(await q(`SELECT pr_number, repo, state, priority, notes FROM jules_queue WHERE state IN ('queued','active')`), null, 2));
