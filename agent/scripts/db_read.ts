import { invokeTool } from '@tasklet/tools/v2';

async function q(query: string) {
  const r = await invokeTool({ toolName: 'run_agent_memory_sql', args: { query } });
  if (!r.ok) return { __error: r.error };
  return await r.json();
}

console.log('--- active/queued queue items ---');
console.log(JSON.stringify(await q(`SELECT id, pr_number, repo, state, priority, ping_count, resolution, notes, updated_at FROM jules_queue WHERE state IN ('queued','active') ORDER BY repo, pr_number`), null, 2));

console.log('--- rows for our two repos (any state) matching PR 687 / 311 ---');
console.log(JSON.stringify(await q(`SELECT id, pr_number, repo, state, resolution, updated_at FROM jules_queue WHERE (pr_number=687 AND repo LIKE '%PhD-Writing') OR (pr_number=311 AND repo LIKE '%bledsoe%')`), null, 2));

console.log('--- repo values not in owner/repo format ---');
console.log(JSON.stringify(await q(`SELECT id, pr_number, repo, state FROM jules_queue WHERE repo NOT LIKE '%/%'`), null, 2));

console.log('--- recent pr_health_alerts (7d) ---');
console.log(JSON.stringify(await q(`SELECT id, pr_number, repo, alert_type, detail, created_at FROM pr_health_alerts WHERE created_at >= datetime('now','-7 days')`), null, 2));

console.log('--- distinct repo values ---');
console.log(JSON.stringify(await q(`SELECT repo, count(*) c, group_concat(DISTINCT state) states FROM jules_queue GROUP BY repo`), null, 2));
