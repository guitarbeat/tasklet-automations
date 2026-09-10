// Jules session cleanup audit — ported from jules_cleanup_audit.py
// Jules reads go through the connection (remote_http_call); GitHub reads use the stored PAT.
// Read-only: no writes, no session deletes. Emits JSON for the dashboard.
import { invokeTool } from '@tasklet/tools/v2';
import { readFileSync, writeFileSync } from 'node:fs';

const JULES_CONN = 'conn_eefcc2t97c0bfqx78k4p';
const JULES_BASE = 'https://jules.googleapis.com/v1alpha';
const OUT = '/tasklet/agent/home/apps/pr-health/jules-audit.json';

const token = readFileSync('/tasklet/agent/home/.secrets/github-merge-token', 'utf8').trim();

async function jules(path: string): Promise<any> {
  // Route through a file to dodge the inline tool-output size cap.
  const tmp = `/tasklet/agent/home/scripts/.jules-tmp.json`;
  const res = await invokeTool({
    toolName: 'remote_http_call',
    connectionId: JULES_CONN,
    args: { url: `${JULES_BASE}${path}`, method: 'GET', outputFile: tmp },
  });
  if (!res.ok) throw new Error(`Jules ${path}: ${res.error}`);
  return JSON.parse(readFileSync(tmp, 'utf8'));
}

const ghCache = new Map<string, any>();
async function gh(path: string): Promise<{ status: number; body: any }> {
  if (ghCache.has(path)) return ghCache.get(path);
  const r = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  let body: any = null;
  try { body = await r.json(); } catch { /* ignore */ }
  const out = { status: r.status, body };
  ghCache.set(path, out);
  return out;
}

async function listSessions(): Promise<any[]> {
  const all: any[] = [];
  let pageToken = '';
  for (let i = 0; i < 50; i++) {
    const q = new URLSearchParams({ pageSize: '30' });
    // Field mask: drop the huge gitPatch bodies, keep only what the audit needs.
    q.set('fields', 'nextPageToken,sessions(name,id,state,title,prompt,sourceContext,outputs.changeSet.gitPatch.baseCommitId)');
    if (pageToken) q.set('pageToken', pageToken);
    const data = await jules(`/sessions?${q}`);
    all.push(...(data.sessions ?? []));
    pageToken = data.nextPageToken ?? '';
    if (!pageToken) break;
  }
  return all;
}

function parseSource(session: any): { owner: string; repo: string } | null {
  // e.g. "sources/github/owner/repo"
  const src: string = session.sourceContext?.source ?? session.source ?? '';
  const m = src.match(/github\/([^/]+)\/([^/]+)/);
  if (m) return { owner: m[1], repo: m[2] };
  return null;
}

function startingBranch(session: any): string | null {
  return session.sourceContext?.githubRepoContext?.startingBranch ?? null;
}

function outputBaseCommit(session: any): string | null {
  const outs = session.outputs ?? [];
  for (const o of outs) {
    const base = o?.changeSet?.gitPatch?.baseCommitId;
    if (base) return base;
  }
  return null;
}

function parsePrNumber(session: any): number | null {
  const hay = `${session.title ?? ''}\n${session.prompt ?? ''}`;
  const m = hay.match(/PR\s*#(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

async function main() {
  const sessions = await listSessions();
  const byState: Record<string, number> = {};
  const staleOutputs: any[] = [];
  const misconfiguredActive: any[] = [];
  const lingeringClosed: any[] = [];
  const errors: any[] = [];

  for (const s of sessions) {
    const state = s.state ?? 'UNKNOWN';
    byState[state] = (byState[state] ?? 0) + 1;
    const id = (s.name ?? '').split('/').pop() ?? s.id ?? '?';
    const title = s.title ?? '(untitled)';
    const src = parseSource(s);
    if (!src) continue;
    const { owner, repo } = src;
    const branch = startingBranch(s);

    // Stale output: patch base commit != current head of starting branch
    const base = outputBaseCommit(s);
    if (base && branch) {
      const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
      const headSha = ref.body?.object?.sha;
      if (ref.status === 200 && headSha && headSha !== base) {
        staleOutputs.push({ id, title, repo: `${owner}/${repo}`, branch, base: base.slice(0, 7), head: String(headSha).slice(0, 7), state });
      }
    }

    // PR-linked checks
    const prNum = parsePrNumber(s);
    if (prNum) {
      const pr = await gh(`/repos/${owner}/${repo}/pulls/${prNum}`);
      if (pr.status === 200) {
        const prState = pr.body?.state;
        const merged = pr.body?.merged;
        const headRef = pr.body?.head?.ref;
        if (prState === 'closed') {
          lingeringClosed.push({ id, title, repo: `${owner}/${repo}`, pr: prNum, merged: !!merged, state });
        }
        const active = ['IN_PROGRESS', 'PLANNING', 'AWAITING_PLAN_APPROVAL', 'AWAITING_USER_FEEDBACK', 'QUEUED', 'PAUSED'].includes(state);
        if (active && branch && headRef && branch !== headRef) {
          misconfiguredActive.push({ id, title, repo: `${owner}/${repo}`, pr: prNum, sessionBranch: branch, prBranch: headRef, state });
        }
      } else if (pr.status !== 404) {
        errors.push({ id, repo: `${owner}/${repo}`, pr: prNum, ghStatus: pr.status });
      }
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    total_sessions: sessions.length,
    by_state: byState,
    findings: {
      stale_outputs: staleOutputs,
      misconfigured_active_prs: misconfiguredActive,
      lingering_closed_or_merged: lingeringClosed,
    },
    counts: {
      stale_outputs: staleOutputs.length,
      misconfigured_active_prs: misconfiguredActive.length,
      lingering_closed_or_merged: lingeringClosed.length,
    },
    errors,
  };
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ total: sessions.length, byState, counts: report.counts, errors: errors.length }, null, 2));
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
