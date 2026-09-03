// Deterministic PR + issue scanner for the caretaker.
// NO judgment, NO LLM: pure API reads -> verified JSON artifact.
// Counting is the thing agents fabricate, so it lives here instead.
//
// Output: /tasklet/agent/home/state/pr-scan.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const TOKEN = readFileSync('/tasklet/agent/home/.secrets/github-merge-token', 'utf8').trim();
const REPOS: string[] = JSON.parse(
  readFileSync('/tasklet/agent/home/apps/pr-health/selected-repos.json', 'utf8'),
);
const STATE_DIR = '/tasklet/agent/home/state';
const OUT = `${STATE_DIR}/pr-scan.json`;

const BOTS = ['dependabot[bot]', 'imgbot', 'imgbot[bot]', 'github-actions[bot]'];

async function gh(path: string): Promise<any> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'tasklet-caretaker',
    },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/** Probe whether the PAT can write. One global check, not per-PR. */
async function probeWrite(repo: string): Promise<{ canWrite: boolean; status: number }> {
  const res = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'tasklet-caretaker',
    },
    body: JSON.stringify({
      ref: 'refs/heads/probe-write-check',
      sha: '0000000000000000000000000000000000000000',
    }),
  });
  // 403 = no write scope. 422 = scope OK, bad sha (expected on a write-capable token).
  return { canWrite: res.status !== 403, status: res.status };
}

async function scanRepo(repo: string) {
  // Two independent sources for the open count — they must agree.
  const list = await gh(`/repos/${repo}/pulls?state=open&per_page=100`);
  const search = await gh(`/search/issues?q=repo:${repo}+is:pr+is:open`);
  const listCount = list.length;
  const searchCount = search.total_count;

  const prs = [];
  for (const p of list) {
    // Per-PR fetch: mergeable/mergeable_state are absent from the list endpoint.
    const full = await gh(`/repos/${repo}/pulls/${p.number}`);
    const author = full.user?.login ?? '';
    const idle = daysSince(full.updated_at);
    prs.push({
      number: full.number,
      repo,
      title: full.title,
      author,
      isBot: BOTS.includes(author),
      state: full.state,
      draft: !!full.draft,
      mergeable: full.mergeable,
      mergeableState: full.mergeable_state,
      branch: full.head?.ref ?? '',
      createdAt: full.created_at,
      updatedAt: full.updated_at,
      daysIdle: idle,
      classification: idle > 90 ? 'dead' : idle > 14 ? 'stale' : 'fresh',
    });
  }

  const issuesRaw = await gh(`/repos/${repo}/issues?state=open&per_page=100`);
  const issues = issuesRaw
    .filter((i: any) => !i.pull_request)
    .map((i: any) => ({
      number: i.number,
      repo,
      title: i.title,
      comments: i.comments,
      createdAt: i.created_at,
      daysOpen: daysSince(i.created_at),
      unattended: daysSince(i.created_at) > 30 && i.comments === 0,
    }));

  // Duplicate titles, computed not guessed.
  const byTitle: Record<string, number[]> = {};
  for (const i of issues) (byTitle[i.title] ??= []).push(i.number);
  const duplicates = Object.entries(byTitle)
    .filter(([, nums]) => nums.length > 1)
    .map(([title, nums]) => ({
      title,
      numbers: nums.sort((a, b) => b - a),
      keep: Math.max(...nums),
      close: nums.filter((n) => n !== Math.max(...nums)),
    }));

  return {
    repo,
    openPRCount: listCount,
    countVerified: listCount === searchCount,
    countSources: { pullsList: listCount, searchApi: searchCount },
    prs,
    openIssueCount: issues.length,
    issues,
    duplicates,
  };
}

const repos = [];
for (const r of REPOS) repos.push(await scanRepo(r));

const write = await probeWrite(REPOS[0]);

const result = {
  scannedAt: new Date().toISOString(),
  token: { canWrite: write.canWrite, probeStatus: write.status },
  repos,
  totals: {
    openPRs: repos.reduce((n, r) => n + r.openPRCount, 0),
    openIssues: repos.reduce((n, r) => n + r.openIssueCount, 0),
    botPRs: repos.reduce((n, r) => n + r.prs.filter((p) => p.isBot).length, 0),
    humanPRs: repos.reduce((n, r) => n + r.prs.filter((p) => !p.isBot).length, 0),
    stale: repos.reduce((n, r) => n + r.prs.filter((p) => p.classification !== 'fresh').length, 0),
    duplicateGroups: repos.reduce((n, r) => n + r.duplicates.length, 0),
  },
  discrepancies: repos
    .filter((r) => !r.countVerified)
    .map((r) => ({ repo: r.repo, ...r.countSources })),
};

mkdirSync(STATE_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 2));

console.log(JSON.stringify({ ...result, repos: undefined }, null, 2));
console.log(`\nwrote ${OUT}`);
