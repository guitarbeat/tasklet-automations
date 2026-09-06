import { createRoot } from 'react-dom/client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  Radar,
  ChevronUp,
  ChevronDown,
  X,
  Play,
  Search,
  CheckCircle,
  XCircle,
  SkipForward,
  Bell,
  GitMerge,
  RotateCcw,
  Clock,
  ArrowRight,
  Archive,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  Zap,
  Shield,
  Palette,
  Package,
  Activity,
  Circle,
  Hash,
  Timer,
  Inbox,
  TrendingUp,
  Trash2,
  CalendarDays,
  FileCode,
  Eye,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Gauge,
  Info,
  FolderGit2,
  Lock,
  Star,
  Check,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  PullRequest,
  QueueItem,
  RepoHealth,
  ActivityLogEntry,
  HealthScore,
  PRDetail,
  TokenStatus,
} from './types';
import { ConversationPanel } from './components/ConversationPanel';
import { TokenPanel } from './components/TokenPanel';
import { JulesAuditPanel } from './components/JulesAuditPanel';
import { PRTreemap } from './components/PRTreemap';
import {
  daysSince,
  formatAge,
  detectAgent,
  AGENT,
  staleness,
  repoHealth,
  resolutionInfo,
  RESOLUTIONS,
  PRIORITY,
  computeHealthScore,
  GRADE_COLORS,
  formatSize,
  sizeColor,
} from './utils/helpers';
import {
  runCaretakerPrompt,
  activatePRPrompt,
  checkStatusPrompt,
  pingJulesPrompt,
  autoClosePrompt,
} from './utils/prompts';

/* ─── Constants ─────────────────────────────────────────────── */
const DEFAULT_REPOS = ['guitarbeat/bledsoe-mobile-notary', 'guitarbeat/PhD-Writing'];
const GITHUB_CONN = 'conn_8et0d5bx3yszdanafpnb';
const REPO_PREF_FILE = '/tasklet/agent/home/apps/pr-health/selected-repos.json';
const api = window.tasklet;

interface RepoOption {
  fullName: string;
  private: boolean;
  language: string | null;
  updatedAt: string;
  stargazersCount: number;
}

const PRIORITY_META: Record<number, { label: string; icon: React.ReactNode; color: string }> = {
  3: {
    label: 'Critical',
    icon: <Shield size={11} />,
    color: 'text-error bg-error/10 border-error/20',
  },
  2: {
    label: 'High',
    icon: <Zap size={11} />,
    color: 'text-warning bg-warning/10 border-warning/20',
  },
  1: { label: 'Normal', icon: <Palette size={11} />, color: 'text-info bg-info/10 border-info/20' },
  0: {
    label: 'Low',
    icon: <Package size={11} />,
    color: 'text-base-content/40 bg-base-200 border-base-300',
  },
};

const LIFECYCLE = [
  { key: 'queued', label: 'Queued', desc: 'PR is in the queue', icon: <Inbox size={14} /> },
  { key: 'activated', label: 'Active', desc: 'Session started', icon: <Play size={14} /> },
  { key: 'pinged', label: 'Pinged', desc: '@jules comment posted', icon: <Bell size={14} /> },
  { key: 'waiting', label: 'Waiting', desc: 'Awaiting Jules response', icon: <Timer size={14} /> },
  { key: 'resolved', label: 'Done', desc: 'Resolved or failed', icon: <CheckCircle size={14} /> },
] as const;

function lifecycleStep(item: QueueItem): number {
  if (item.state === 'resolved' || item.state === 'failed' || item.state === 'skipped') return 4;
  if (item.state === 'active' && item.ping_count > 0) return 3;
  if (item.state === 'active') return 1;
  return 0;
}

const ACTION_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  scan: { icon: <Radar size={13} />, label: 'Scan completed', color: 'text-primary' },
  queued: { icon: <Inbox size={13} />, label: 'Added to queue', color: 'text-base-content/60' },
  activated: { icon: <Play size={13} />, label: 'Session activated', color: 'text-info' },
  pinged: { icon: <Bell size={13} />, label: 'Jules pinged', color: 'text-info' },
  're-pinged': { icon: <Bell size={13} />, label: 'Jules re-pinged', color: 'text-warning' },
  'status-check': {
    icon: <Search size={13} />,
    label: 'Status checked',
    color: 'text-base-content/60',
  },
  resolved: { icon: <CheckCircle size={13} />, label: 'Resolved', color: 'text-success' },
  resolved_merged: {
    icon: <GitMerge size={13} />,
    label: 'Merged successfully',
    color: 'text-success',
  },
  resolved_failed: { icon: <XCircle size={13} />, label: 'Marked as failed', color: 'text-error' },
  failed: { icon: <XCircle size={13} />, label: 'Failed', color: 'text-error' },
  skipped: { icon: <SkipForward size={13} />, label: 'Skipped', color: 'text-base-content/40' },
  'auto-closed': {
    icon: <Archive size={13} />,
    label: 'Auto-closed (dead PR)',
    color: 'text-warning',
  },
  scanned: { icon: <Radar size={13} />, label: 'Scan completed', color: 'text-primary' },
};
const defaultActionMeta = {
  icon: <Clock size={13} />,
  label: 'Action',
  color: 'text-base-content/40',
};

/* ─── Main App ──────────────────────────────────────────────── */
export default function App() {
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [mainShas, setMainShas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(
    null,
  );
  const [agentBusy, setAgentBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'current' | 'stale' | 'dead'>('all');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    msg: string;
    onConfirm: () => void;
  } | null>(null);

  /* ─── Repo selection ────────────────────────────────────────── */
  const [selectedRepos, setSelectedRepos] = useState<string[]>(DEFAULT_REPOS);
  const [availableRepos, setAvailableRepos] = useState<RepoOption[]>([]);
  const [repoPickerOpen, setRepoPickerOpen] = useState(false);
  const [reposReady, setReposReady] = useState(false);
  const [tokenPanelOpen, setTokenPanelOpen] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>({ configured: false });

  /* ─── API cost tracking ─────────────────────────────────────── */
  const [apiCalls, setApiCalls] = useState<{
    listPR: number;
    getPR: number;
    sql: number;
    total: number;
    costCents: number;
  }>({
    listPR: 0,
    getPR: 0,
    sql: 0,
    total: 0,
    costCents: 0,
  });
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const ask = (title: string, msg: string, onConfirm: () => void) => {
    setConfirmDialog({ title, msg, onConfirm });
  };

  /* ─── Agent actions ────────────────────────────────────────── */
  const askAgent = async (message: string, label: string) => {
    setAgentBusy(true);
    showToast(`${label}…`, 'info');
    try {
      await api.sendMessageToAgent(message);
      showToast(`Agent is on it: ${label}`, 'success');
    } catch (e: any) {
      showToast(`Agent error: ${e.message}`, 'error');
    }
    setAgentBusy(false);
  };

  const agentRunCaretaker = () => askAgent(runCaretakerPrompt(), 'Running caretaker');
  const agentActivatePR = (item: QueueItem) =>
    askAgent(activatePRPrompt(item.repo, item.pr_number), `Activating #${item.pr_number}`);
  const agentCheckStatus = (item: QueueItem) =>
    askAgent(checkStatusPrompt(item.repo, item.pr_number), `Checking #${item.pr_number}`);
  const agentPingJules = (item: QueueItem) =>
    askAgent(
      pingJulesPrompt(item.repo, item.pr_number, item.ping_count),
      `Re-pinging Jules on #${item.pr_number}`,
    );
  const agentAutoClose = (pr: PullRequest) =>
    askAgent(
      autoClosePrompt(pr.repo, pr.number, daysSince(pr.updatedAt)),
      `Auto-closing #${pr.number}`,
    );

  /* ─── Data loading ─────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const calls = { listPR: 0, getPR: 0, sql: 0 };
    try {
      const allPrs: PullRequest[] = [];
      const shas: Record<string, string> = {};
      const results = await Promise.all(
        selectedRepos.map(async (repo) => {
          const [owner, name] = repo.split('/');
          calls.listPR++;
          return {
            repo,
            data: await api.runTool('conn_8et0d5bx3yszdanafpnb__github_list_pull_requests', {
              owner,
              repo: name,
              state: 'open',
              per_page: 100,
              readMask: ['branches', 'dates', 'user'],
            }),
          };
        }),
      );
      for (const { repo, data } of results) {
        const items = Array.isArray(data) ? data : [];
        for (const pr of items as any[]) {
          allPrs.push({
            number: pr.number,
            title: pr.title,
            repo,
            author: pr.user || 'unknown',
            createdAt: pr.createdAt,
            updatedAt: pr.updatedAt,
            baseSha: pr.base?.sha || '',
            headBranch: pr.head?.ref || '',
            url: `https://github.com/${repo}/pull/${pr.number}`,
            agentType: detectAgent(pr.title),
          });
        }
        if (items.length > 0) {
          const sorted = [...items].sort((a: any, b: any) => b.number - a.number);
          shas[repo] = sorted[0]?.base?.sha || '';
        }
      }
      setMainShas(shas);
      setPrs(allPrs);

      // Fetch detailed PR data (reviews, size, draft status) in parallel — max 6 concurrent
      const fetchDetail = async (
        pr: PullRequest,
      ): Promise<{ number: number; repo: string; detail: PRDetail }> => {
        try {
          const [owner, name] = pr.repo.split('/');
          calls.getPR++;
          const d: any = await api.runTool('conn_8et0d5bx3yszdanafpnb__github_get_pull_request', {
            owner,
            repo: name,
            pull_number: pr.number,
          });
          return {
            number: pr.number,
            repo: pr.repo,
            detail: {
              draft: d.draft || false,
              labels: d.labels || [],
              additions: d.additions || 0,
              deletions: d.deletions || 0,
              changedFiles: d.changedFiles || 0,
              mergedAt: d.mergedAt || null,
              closedAt: d.closedAt || null,
              reviewStatus: d.currentReviewStatus?.overallStatus || 'NO_REVIEWS',
              approvedBy: d.currentReviewStatus?.approvedBy || [],
              changesRequestedBy: d.currentReviewStatus?.changesRequestedBy || [],
              totalReviews: d.currentReviewStatus?.totalSubmissions || 0,
            },
          };
        } catch {
          return {
            number: pr.number,
            repo: pr.repo,
            detail: {
              draft: false,
              labels: [],
              additions: 0,
              deletions: 0,
              changedFiles: 0,
              mergedAt: null,
              closedAt: null,
              reviewStatus: 'NO_REVIEWS',
              approvedBy: [],
              changesRequestedBy: [],
              totalReviews: 0,
            },
          };
        }
      };

      // Batch fetch details (6 at a time to avoid rate limiting)
      const details: Map<string, PRDetail> = new Map();
      for (let i = 0; i < allPrs.length; i += 6) {
        const batch = allPrs.slice(i, i + 6);
        const results = await Promise.all(batch.map(fetchDetail));
        for (const r of results) {
          details.set(`${r.repo}#${r.number}`, r.detail);
        }
      }

      // Merge details into PRs
      const enriched = allPrs.map((pr) => ({
        ...pr,
        detail: details.get(`${pr.repo}#${pr.number}`),
      }));
      setPrs(enriched);

      calls.sql++;
      const qRes = await api.sqlQuery(
        "SELECT * FROM jules_queue ORDER BY CASE state WHEN 'active' THEN 0 WHEN 'queued' THEN 1 WHEN 'resolved' THEN 2 WHEN 'failed' THEN 3 ELSE 4 END, priority DESC, created_at ASC",
      );
      setQueue(Array.isArray(qRes) ? (qRes as unknown as QueueItem[]) : []);

      try {
        calls.sql++;
        const logRes = await api.sqlQuery(
          'SELECT * FROM jules_activity_log ORDER BY created_at DESC LIMIT 50',
        );
        setActivityLog(Array.isArray(logRes) ? (logRes as unknown as ActivityLogEntry[]) : []);
      } catch {
        setActivityLog([]);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    }

    // Estimate token costs: ~1.5K tokens per list call, ~2K per get call, ~0.5K per SQL
    // Using $3/1M input tokens as rough estimate for tool call overhead
    const totalCalls = calls.listPR + calls.getPR + calls.sql;
    const estimatedTokens = calls.listPR * 1500 + calls.getPR * 2000 + calls.sql * 500;
    const costCents = (estimatedTokens / 1_000_000) * 300; // $3/1M tokens → cents
    setApiCalls({ ...calls, total: totalCalls, costCents: Math.round(costCents * 100) / 100 });
    setLastRefreshed(new Date());
    setLoading(false);
  }, [selectedRepos]);

  /* Load persisted repo selection once on mount, then allow scanning. */
  useEffect(() => {
    (async () => {
      try {
        const raw = await api.readFileFromDisk(REPO_PREF_FILE);
        const saved = JSON.parse(raw) as string[];
        if (Array.isArray(saved) && saved.length > 0) setSelectedRepos(saved);
      } catch {
        /* no saved prefs yet — use defaults */
      } finally {
        setReposReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (reposReady) load();
  }, [load, reposReady]);

  /* Load merge-token status (token-free metadata) once on mount. */
  useEffect(() => {
    (async () => {
      try {
        const raw = await api.readFileFromDisk(
          '/tasklet/agent/home/.secrets/github-merge-token.status.json',
        );
        const s = JSON.parse(raw) as TokenStatus;
        if (s && s.configured) setTokenStatus(s);
      } catch {
        /* no token configured yet */
      }
    })();
  }, []);

  /* Fetch the user's GitHub repos for the picker (lazy, on first open). */
  const fetchAvailableRepos = useCallback(async () => {
    if (availableRepos.length > 0) return;
    try {
      const res = await api.invokeTool({
        toolName: 'github_list_repositories',
        connectionId: GITHUB_CONN,
        args: { per_page: 100, sort: 'updated', type: 'all' },
      });
      const list: any[] = Array.isArray(res)
        ? res
        : Array.isArray((res as any)?.repositories)
          ? (res as any).repositories
          : Array.isArray((res as any)?.data)
            ? (res as any).data
            : [];
      const opts: RepoOption[] = list
        .map((r: any) => ({
          fullName: r.full_name ?? r.fullName ?? '',
          private: Boolean(r.private),
          language: r.language ?? null,
          updatedAt: r.updated_at ?? r.updatedAt ?? '',
          stargazersCount: r.stargazers_count ?? r.stargazersCount ?? 0,
        }))
        .filter((r: RepoOption) => r.fullName);
      setAvailableRepos(opts);
    } catch (err) {
      console.error('Failed to list repositories:', err);
    }
  }, [availableRepos.length]);

  const persistRepos = (repos: string[]) => {
    setSelectedRepos(repos);
    api.writeFileToDisk(REPO_PREF_FILE, JSON.stringify(repos)).catch((err) => {
      console.error('Failed to persist repo selection:', err);
    });
  };

  const toggleRepo = (fullName: string) => {
    const next = selectedRepos.includes(fullName)
      ? selectedRepos.filter((r) => r !== fullName)
      : [...selectedRepos, fullName];
    if (next.length === 0) return; // never allow zero repos
    persistRepos(next);
  };

  const openRepoPicker = () => {
    setRepoPickerOpen(true);
    void fetchAvailableRepos();
  };

  /* ─── Local DB actions ─────────────────────────────────────── */
  const reloadQueue = async () => {
    const qRes = await api.sqlQuery(
      "SELECT * FROM jules_queue ORDER BY CASE state WHEN 'active' THEN 0 WHEN 'queued' THEN 1 WHEN 'resolved' THEN 2 WHEN 'failed' THEN 3 ELSE 4 END, priority DESC, created_at ASC",
    );
    setQueue(Array.isArray(qRes) ? (qRes as unknown as QueueItem[]) : []);
    try {
      const logRes = await api.sqlQuery(
        'SELECT * FROM jules_activity_log ORDER BY created_at DESC LIMIT 50',
      );
      setActivityLog(Array.isArray(logRes) ? (logRes as unknown as ActivityLogEntry[]) : []);
    } catch {}
  };

  const withAction = async (key: string, fn: () => Promise<void>) => {
    setActionLoading(key);
    try {
      await fn();
    } catch (e: any) {
      showToast(e.message || 'Action failed', 'error');
    }
    setActionLoading(null);
  };

  const queuePR = (pr: PullRequest) =>
    withAction(`q-${pr.number}`, async () => {
      const priority = PRIORITY[pr.agentType] ?? 0;
      await api.sqlExec(
        `INSERT OR IGNORE INTO jules_queue (pr_number, repo, state, priority, notes) VALUES (${pr.number}, '${pr.repo}', 'queued', ${priority}, '${pr.title.replace(/'/g, "''")}')`,
      );
      showToast(`#${pr.number} queued`);
      await reloadQueue();
    });

  const removeFromQueue = (item: QueueItem) => {
    ask(
      'Remove from queue?',
      `Remove PR #${item.pr_number} from ${item.repo}? This action cannot be undone.`,
      () =>
        withAction(`rm-${item.id}`, async () => {
          await api.sqlExec(`DELETE FROM jules_queue WHERE id = ${item.id}`);
          showToast(`#${item.pr_number} removed`);
          await reloadQueue();
        }),
    );
  };

  const resolvePR = (item: QueueItem, resolution: string) =>
    withAction(`res-${item.id}`, async () => {
      await api.sqlExec(
        `UPDATE jules_queue SET state = 'resolved', resolution = '${resolution}', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = ${item.id}`,
      );
      showToast(`#${item.pr_number} → ${resolution}`);
      await reloadQueue();
    });

  const failPR = (item: QueueItem) =>
    withAction(`fail-${item.id}`, async () => {
      await api.sqlExec(
        `UPDATE jules_queue SET state = 'failed', resolution = 'jules-failed', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = ${item.id}`,
      );
      showToast(`#${item.pr_number} marked failed`);
      await reloadQueue();
    });

  const skipPR = (item: QueueItem) =>
    withAction(`skip-${item.id}`, async () => {
      await api.sqlExec(
        `UPDATE jules_queue SET state = 'skipped', resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = ${item.id}`,
      );
      showToast(`#${item.pr_number} skipped`);
      await reloadQueue();
    });

  const changePriority = (item: QueueItem, delta: number) =>
    withAction(`pri-${item.id}`, async () => {
      const p = Math.max(0, Math.min(3, item.priority + delta));
      await api.sqlExec(
        `UPDATE jules_queue SET priority = ${p}, updated_at = datetime('now') WHERE id = ${item.id}`,
      );
      await reloadQueue();
    });

  const queueAllStale = () =>
    withAction('queue-all', async () => {
      const stalePrs = prs.filter((p) => {
        const s = staleness(p, mainShas[p.repo]);
        return (
          (s === 'stale' || s === 'dead') &&
          !queue.some((q) => q.pr_number === p.number && q.repo === p.repo)
        );
      });
      let added = 0;
      for (const pr of stalePrs) {
        const priority = PRIORITY[pr.agentType] ?? 0;
        try {
          await api.sqlExec(
            `INSERT OR IGNORE INTO jules_queue (pr_number, repo, state, priority, notes) VALUES (${pr.number}, '${pr.repo}', 'queued', ${priority}, '${pr.title.replace(/'/g, "''")}')`,
          );
          added++;
        } catch {}
      }
      showToast(`${added} PRs queued`);
      await reloadQueue();
    });

  /* ─── Archive / Bulk actions ─────────────────────────────── */
  const archiveItem = (item: QueueItem) =>
    withAction(`arc-${item.id}`, async () => {
      await api.sqlExec(
        `UPDATE jules_queue SET state = 'archived', updated_at = datetime('now') WHERE id = ${item.id}`,
      );
      showToast(`#${item.pr_number} archived`);
      await reloadQueue();
    });

  const bulkDelete = (ids: number[]) => {
    ask(
      'Delete items?',
      `Permanently delete ${ids.length} item${ids.length > 1 ? 's' : ''}? This cannot be undone.`,
      () =>
        withAction('bulk-del', async () => {
          await api.sqlExec(`DELETE FROM jules_queue WHERE id IN (${ids.join(',')})`);
          showToast(`${ids.length} item${ids.length > 1 ? 's' : ''} deleted`);
          await reloadQueue();
        }),
    );
  };

  const bulkArchive = (ids: number[]) =>
    withAction('bulk-arc', async () => {
      await api.sqlExec(
        `UPDATE jules_queue SET state = 'archived', updated_at = datetime('now') WHERE id IN (${ids.join(',')})`,
      );
      showToast(`${ids.length} item${ids.length > 1 ? 's' : ''} archived`);
      await reloadQueue();
    });

  /* ─── Derived state ────────────────────────────────────────── */
  const activePR = queue.find((q) => q.state === 'active');
  const queued = queue
    .filter((q) => q.state === 'queued')
    .sort((a, b) => b.priority - a.priority || a.id - b.id);
  const resolved = queue.filter(
    (q) =>
      q.state === 'resolved' ||
      q.state === 'failed' ||
      q.state === 'skipped' ||
      q.state === 'archived',
  );
  const repos: RepoHealth[] = selectedRepos.map((r) => repoHealth(prs, r, mainShas[r] || ''));
  const staleCount = prs.filter((p) => staleness(p, mainShas[p.repo]) === 'stale').length;
  const deadCount = prs.filter((p) => staleness(p, mainShas[p.repo]) === 'dead').length;
  const currentCount = prs.filter((p) => staleness(p, mainShas[p.repo]) === 'current').length;
  const unqueuedStaleCount = prs.filter((p) => {
    const s = staleness(p, mainShas[p.repo]);
    return (
      (s === 'stale' || s === 'dead') &&
      !queue.some((q) => q.pr_number === p.number && q.repo === p.repo)
    );
  }).length;
  const queuedKeys = useMemo(
    () =>
      new Set(
        queue
          .filter((q) => q.state === 'queued' || q.state === 'active')
          .map((q) => `${q.repo}#${q.pr_number}`),
      ),
    [queue],
  );
  const activeLogEntries = activePR
    ? activityLog.filter((l) => l.pr_number === activePR.pr_number && l.repo === activePR.repo)
    : [];
  const filtered = useMemo(
    () =>
      prs
        .filter((p) => filter === 'all' || staleness(p, mainShas[p.repo]) === filter)
        .sort((a, b) => {
          const order = { dead: 0, stale: 1, current: 2 };
          const sa = staleness(a, mainShas[a.repo]);
          const sb = staleness(b, mainShas[b.repo]);
          return order[sa] - order[sb] || daysSince(b.createdAt) - daysSince(a.createdAt);
        }),
    [prs, mainShas, filter],
  );

  /* ─── Next action prediction ───────────────────────────────── */
  function nextActionText(item: QueueItem | undefined): {
    text: string;
    detail: string;
    urgent: boolean;
  } {
    if (!item)
      return {
        text: queued.length > 0 ? 'Ready to activate next PR' : 'Queue is empty — all clear',
        detail:
          queued.length > 0
            ? `${queued.length} PRs waiting — activate the top one to start a Jules session`
            : 'Run a scan or queue stale PRs to get started',
        urgent: queued.length > 0,
      };
    if (item.ping_count === 0)
      return {
        text: 'Waiting for agent to ping Jules',
        detail: 'The agent will post a @jules comment to kick off the rebase',
        urgent: false,
      };
    if (item.ping_count < 3) {
      const lastPing = item.last_pinged_at ? daysSince(item.last_pinged_at) : 0;
      if (lastPing >= 7)
        return {
          text: 'Time to follow up',
          detail: `Last ping was ${lastPing}d ago — consider re-pinging Jules`,
          urgent: true,
        };
      return {
        text: 'Waiting for Jules to respond',
        detail: `Ping ${item.ping_count}/3 · sent ${lastPing}d ago · next auto-check Monday`,
        urgent: false,
      };
    }
    return {
      text: 'Max pings reached — decision needed',
      detail: 'Jules pinged 3×. Resolve manually, mark failed, or skip.',
      urgent: true,
    };
  }

  /* ─── Render ───────────────────────────────────────────────── */
  if (loading)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-base-100">
        <span className="loading loading-ring loading-lg text-primary" />
        <p className="text-sm text-base-content/40">Pulling live data from GitHub…</p>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-base-100">
        <div className="alert alert-error max-w-md shadow-lg">
          <AlertTriangle size={18} />
          <div>
            <p className="font-semibold">Failed to load</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={load}>
            Retry
          </button>
        </div>
      </div>
    );

  const nextAction = nextActionText(activePR);

  return (
    <div className="min-h-screen bg-base-100">
      {/* ─ Toast ─ */}
      {toast && (
        <div
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className={`toast-enter fixed top-3 right-3 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-success text-success-content'
              : toast.type === 'info'
                ? 'bg-info text-info-content'
                : 'bg-error text-error-content'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle size={14} />
          ) : toast.type === 'info' ? (
            <Activity size={14} />
          ) : (
            <AlertTriangle size={14} />
          )}
          {toast.msg}
        </div>
      )}

      {/* ─ Confirmation Dialog ─ */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-base-100 rounded-xl shadow-xl max-w-sm w-full animate-fade-in">
            <div className="px-6 py-4 border-b border-base-200">
              <h2 className="text-base font-bold">{confirmDialog.title}</h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-base-content/70">{confirmDialog.msg}</p>
            </div>
            <div className="px-6 py-3 border-t border-base-200 flex gap-2 justify-end">
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDialog(null)}>
                Cancel
              </button>
              <button
                className="btn btn-sm btn-error"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─ Repo Picker ─ */}
      {repoPickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setRepoPickerOpen(false)}
        >
          <div
            className="bg-base-100 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-base-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderGit2 size={16} className="text-primary" />
                <h2 className="text-sm font-bold">Monitored repositories</h2>
                <span className="badge badge-sm badge-primary badge-outline tabular-nums">
                  {selectedRepos.length}
                </span>
              </div>
              <button
                className="btn btn-xs btn-ghost btn-square"
                onClick={() => setRepoPickerOpen(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-5 py-2 border-b border-base-200/60">
              <p className="text-[11px] text-base-content/50 leading-snug">
                Pick which repos the dashboard and caretaker watch. Selection is saved and persists
                across sessions.
              </p>
            </div>
            <div className="overflow-y-auto px-2 py-2 flex-1">
              {availableRepos.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-base-content/40">
                  <span className="loading loading-spinner loading-sm" />
                  <span className="text-xs">Loading your repositories…</span>
                </div>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {[...availableRepos]
                    .sort((a, b) => {
                      const aSel = selectedRepos.includes(a.fullName) ? 0 : 1;
                      const bSel = selectedRepos.includes(b.fullName) ? 0 : 1;
                      if (aSel !== bSel) return aSel - bSel;
                      return a.fullName.localeCompare(b.fullName);
                    })
                    .map((r) => {
                      const active = selectedRepos.includes(r.fullName);
                      const onlyOne = active && selectedRepos.length === 1;
                      return (
                        <li key={r.fullName}>
                          <button
                            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                              active ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-base-200/60'
                            } ${onlyOne ? 'cursor-not-allowed opacity-70' : ''}`}
                            onClick={() => !onlyOne && toggleRepo(r.fullName)}
                            title={onlyOne ? 'At least one repo must stay selected' : r.fullName}
                          >
                            <span
                              className={`flex items-center justify-center w-4 h-4 rounded border ${
                                active
                                  ? 'bg-primary border-primary text-primary-content'
                                  : 'border-base-300'
                              }`}
                            >
                              {active && <Check size={11} />}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className="text-xs font-medium truncate">{r.fullName}</span>
                                {r.private && <Lock size={9} className="opacity-50 shrink-0" />}
                              </span>
                              <span className="flex items-center gap-2 text-[10px] text-base-content/40">
                                {r.language && <span>{r.language}</span>}
                                {r.stargazersCount > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <Star size={8} />
                                    {r.stargazersCount}
                                  </span>
                                )}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
            <div className="px-5 py-2.5 border-t border-base-200 flex items-center justify-between">
              <button
                className="btn btn-xs btn-ghost gap-1"
                onClick={() => persistRepos(DEFAULT_REPOS)}
                title="Reset to the two default repos"
              >
                <RotateCcw size={11} /> Defaults
              </button>
              <button className="btn btn-xs btn-primary" onClick={() => setRepoPickerOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {tokenPanelOpen && (
        <TokenPanel
          status={tokenStatus}
          onStatusChange={setTokenStatus}
          onClose={() => setTokenPanelOpen(false)}
        />
      )}

      {/* ━━━ Sticky Header ━━━ */}
      <header className="sticky top-0 z-40 glass-panel border-b border-base-200/50">
        <div className="accent-line" />
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-tight gradient-text">
              Jules Pipeline
            </h1>
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                activePR
                  ? 'bg-info/15 text-info animate-glow'
                  : 'bg-base-200/60 text-base-content/30'
              }`}
            >
              <Circle
                size={4}
                className={activePR ? 'fill-current animate-pulse-soft' : 'fill-current'}
              />
              {activePR ? 'Active' : 'Idle'}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              className="btn btn-sm btn-primary gap-1 rounded-xl shadow-sm shadow-primary/20 h-7 min-h-0 text-xs"
              onClick={agentRunCaretaker}
              disabled={agentBusy}
              title="Run the full caretaker pass: scan PRs & issues, auto-merge safe bot PRs, sync the queue"
            >
              {agentBusy ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Radar size={12} />
              )}
              Run Caretaker
            </button>
            <button
              className="btn btn-sm btn-ghost gap-1 rounded-xl hover:bg-base-200/60 h-7 min-h-0 text-xs"
              onClick={openRepoPicker}
              title="Choose which repositories to monitor"
            >
              <FolderGit2 size={12} />
              <span className="tabular-nums">{selectedRepos.length}</span>
              <ChevronDown size={11} className="opacity-60" />
            </button>
            <button
              className={`btn btn-sm btn-ghost gap-1 rounded-xl hover:bg-base-200/60 h-7 min-h-0 text-xs ${tokenStatus.configured ? 'text-success' : 'text-warning'}`}
              onClick={() => setTokenPanelOpen(true)}
              title={
                tokenStatus.configured
                  ? `Merge token active (as ${tokenStatus.login})`
                  : 'No merge token — merges & sync are blocked. Click to paste one.'
              }
            >
              {tokenStatus.configured ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
              <span className="hidden sm:inline">Token</span>
            </button>
            <button
              className="btn btn-sm btn-ghost btn-square rounded-xl hover:bg-base-200/60 h-7 min-h-0 w-7"
              onClick={load}
              title="Refresh data"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        {/* Compact stats row */}
        <div className="max-w-3xl mx-auto px-4 pb-2 flex items-center gap-1.5 flex-wrap text-[11px]">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold border border-base-200/60 bg-base-200/30">
            <GitMerge size={11} className="opacity-40" />
            <span className="font-extrabold tabular-nums">{prs.length}</span>
            <span className="text-base-content/35 text-[10px]">open</span>
          </span>
          {staleCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold border border-warning/20 bg-warning/8">
              <AlertTriangle size={11} className="text-warning" />
              <span className="font-extrabold tabular-nums text-warning">{staleCount}</span>
              <span className="text-base-content/35 text-[10px]">stale</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold border border-base-200/60 bg-base-200/30">
            <Inbox size={11} className="opacity-40" />
            <span className="font-extrabold tabular-nums">{queued.length}</span>
            <span className="text-base-content/35 text-[10px]">queued</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold border border-success/15 bg-success/6">
            <CheckCircle size={11} className="text-success/70" />
            <span className="font-extrabold tabular-nums text-success">{resolved.length}</span>
            <span className="text-base-content/35 text-[10px]">done</span>
          </span>
          {(() => {
            const scores = prs
              .filter((p) => p.detail)
              .map((p) => computeHealthScore(p, mainShas[p.repo]));
            const avg = scores.length
              ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length)
              : 0;
            const avgGrade =
              avg >= 90 ? 'A' : avg >= 70 ? 'B' : avg >= 50 ? 'C' : avg >= 30 ? 'D' : 'F';
            return scores.length > 0 ? (
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ${GRADE_COLORS[avgGrade as keyof typeof GRADE_COLORS]}`}
              >
                <Gauge size={11} />
                <span className="font-extrabold">{avgGrade}</span>
                <span className="text-[9px] opacity-50">{avg}</span>
              </span>
            ) : null;
          })()}
          {/* Spacer + right-side info */}
          <span className="flex-1" />
          {lastRefreshed && (
            <span className="text-[9px] text-base-content/25 flex items-center gap-1 tabular-nums">
              <Clock size={8} />
              {formatAge(lastRefreshed.toISOString())}
            </span>
          )}
          {apiCalls.total > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowCostBreakdown(!showCostBreakdown)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border border-base-200/60 bg-base-200/30 cursor-pointer hover:border-primary/20 transition-all"
              >
                <Activity size={9} className="opacity-40" />
                <span className="tabular-nums">{apiCalls.total} calls</span>
                <span className="text-base-content/20">·</span>
                <span className="tabular-nums font-semibold text-base-content/50">
                  ~
                  {apiCalls.costCents < 1
                    ? `${(apiCalls.costCents * 10).toFixed(0)}‰¢`
                    : `${apiCalls.costCents.toFixed(1)}¢`}
                </span>
              </button>
              {showCostBreakdown && (
                <div className="absolute right-0 top-full mt-1.5 z-50 glass-panel rounded-xl shadow-2xl p-3 min-w-[220px] text-xs animate-scale-in">
                  <div className="font-bold text-sm mb-2 flex items-center gap-1.5">
                    <Activity size={13} className="text-primary" /> Cost Estimate
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-base-content/50">List PRs</span>
                      <span className="tabular-nums">
                        {apiCalls.listPR} · ~{(apiCalls.listPR * 1.5).toFixed(1)}K tok
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-base-content/50">PR details</span>
                      <span className="tabular-nums">
                        {apiCalls.getPR} · ~{(apiCalls.getPR * 2).toFixed(0)}K tok
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-base-content/50">SQL</span>
                      <span className="tabular-nums">
                        {apiCalls.sql} · ~{(apiCalls.sql * 0.5).toFixed(1)}K tok
                      </span>
                    </div>
                    <div className="border-t border-base-200/50 pt-1.5 mt-1.5 flex justify-between font-bold">
                      <span>Total</span>
                      <span className="tabular-nums text-primary">
                        ~
                        {(
                          (apiCalls.listPR * 1500 + apiCalls.getPR * 2000 + apiCalls.sql * 500) /
                          1000
                        ).toFixed(1)}
                        K tok · ${(apiCalls.costCents / 100).toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-3 space-y-3">
        {/* ━━━ Status Card — compact summary when idle + 0 PRs ━━━ */}
        {prs.length === 0 && !activePR && (
          <div className="animate-fade-in flex items-center gap-3 px-4 py-3 rounded-xl border border-success/20 bg-gradient-to-r from-success/5 to-transparent">
            <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center shrink-0">
              <CheckCircle size={16} className="text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-success leading-tight">All Clear</p>
              <p className="text-[11px] text-base-content/40 leading-tight">
                0 open PRs · {resolved.length} resolved · {selectedRepos.length} repos monitored
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {selectedRepos.map((r) => (
                <a
                  key={r}
                  href={`https://github.com/${r}/pulls`}
                  target="_blank"
                  rel="noopener"
                  className="text-[10px] text-base-content/25 hover:text-primary flex items-center gap-0.5 transition-colors font-medium"
                >
                  {r.split('/')[1]} <ExternalLink size={7} />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ━━━ Active Session Block ━━━ */}
        {activePR && (
          <>
            {/* Compact lifecycle stepper */}
            <div className="flex items-center gap-0 px-1">
              {LIFECYCLE.map((step, i) => {
                const current = lifecycleStep(activePR);
                const isActive = i === current;
                const isDone = i < current;
                return (
                  <React.Fragment key={step.key}>
                    {i > 0 && (
                      <div
                        className={`flex-1 h-px mx-1 ${isDone ? 'bg-success' : isActive ? 'step-active-line h-0.5' : 'bg-base-300'}`}
                      />
                    )}
                    <div className="flex flex-col items-center gap-0.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
                          isDone
                            ? 'bg-success/15 text-success ring-1 ring-success/30'
                            : isActive
                              ? 'bg-info/15 text-info ring-2 ring-info/30 animate-glow'
                              : 'bg-base-200 text-base-content/20'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle size={11} />
                        ) : (
                          React.cloneElement(step.icon as React.ReactElement, { size: 11 })
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold ${isDone ? 'text-success' : isActive ? 'text-info' : 'text-base-content/30'}`}
                      >
                        {step.label}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Next action inline */}
            <div
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs ${
                nextAction.urgent
                  ? 'bg-warning/8 border-warning/20'
                  : 'bg-base-200/40 border-base-200'
              }`}
            >
              <ArrowRight
                size={12}
                className={nextAction.urgent ? 'text-warning' : 'text-base-content/30'}
              />
              <span
                className={`font-semibold ${nextAction.urgent ? 'text-warning' : 'text-base-content/60'}`}
              >
                {nextAction.text}
              </span>
              <span className="text-base-content/30 hidden sm:inline">— {nextAction.detail}</span>
            </div>

            <ActiveSessionCard
              item={activePR}
              prs={prs}
              logEntries={activeLogEntries}
              onResolve={resolvePR}
              onSkip={skipPR}
              onFail={failPR}
              onCheckStatus={agentCheckStatus}
              onRePing={agentPingJules}
              actionLoading={actionLoading}
              agentBusy={agentBusy}
            />
          </>
        )}

        {/* ━━━ Next action when no active but items queued ━━━ */}
        {!activePR && queued.length > 0 && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-warning/20 bg-warning/8">
            <ArrowRight size={12} className="text-warning" />
            <span className="text-xs font-semibold text-warning flex-1">
              {queued.length} PR{queued.length > 1 ? 's' : ''} waiting — ready to activate
            </span>
            <button
              className="btn btn-xs btn-info gap-1 rounded-lg"
              onClick={() => agentActivatePR(queued[0])}
              disabled={agentBusy}
            >
              <Play size={10} /> #{queued[0].pr_number}
            </button>
          </div>
        )}

        {/* ━━━ Repo Health + PRs (when PRs exist) ━━━ */}
        {prs.length > 0 && (
          <>
            {/* Compact repo health cards */}
            {repos.some((r) => r.total > 0) && (
              <div className="grid grid-cols-2 gap-2">
                {repos
                  .filter((r) => r.total > 0)
                  .map((r) => {
                    const pct = r.healthPct;
                    return (
                      <div
                        key={r.name}
                        className={`rounded-lg border border-base-200 p-2.5 ring-1 ${
                          pct >= 80
                            ? 'ring-success/15'
                            : pct >= 50
                              ? 'ring-warning/15'
                              : 'ring-error/15'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-black w-5 h-5 rounded flex items-center justify-center ${
                                pct >= 80
                                  ? 'bg-success/10 text-success'
                                  : pct >= 50
                                    ? 'bg-warning/10 text-warning'
                                    : 'bg-error/10 text-error'
                              }`}
                            >
                              {pct >= 80 ? 'A' : pct >= 50 ? 'C' : 'F'}
                            </span>
                            <a
                              href={`https://github.com/${r.name}/pulls`}
                              target="_blank"
                              rel="noopener"
                              className="text-xs font-semibold hover:underline"
                            >
                              {r.name.split('/')[1]}
                            </a>
                            <span className="text-[9px] text-base-content/25">{r.total}</span>
                          </div>
                          <span
                            className={`text-sm font-bold tabular-nums ${pct >= 80 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-error'}`}
                          >
                            {pct}%
                          </span>
                        </div>
                        <div className="flex h-1 rounded-full overflow-hidden bg-base-200/60 gap-px">
                          {r.current > 0 && (
                            <div
                              className="bg-success rounded-full"
                              style={{ width: `${(r.current / r.total) * 100}%` }}
                            />
                          )}
                          {r.stale > 0 && (
                            <div
                              className="bg-warning rounded-full"
                              style={{ width: `${(r.stale / r.total) * 100}%` }}
                            />
                          )}
                          {r.dead > 0 && (
                            <div
                              className="bg-error rounded-full"
                              style={{ width: `${(r.dead / r.total) * 100}%` }}
                            />
                          )}
                        </div>
                        <div className="flex gap-2 mt-1 text-[9px] text-base-content/30">
                          <span>{r.current} ok</span>
                          <span>{r.stale} stale</span>
                          {r.dead > 0 && <span>{r.dead} dead</span>}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* PR treemap */}
            <PRTreemap prs={prs} mainShas={mainShas} queuedKeys={queuedKeys} onQueue={queuePR} />

            {/* PR list with filters */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h2 className="section-title text-xs">Open PRs</h2>
                  <span className="text-[9px] text-base-content/20 tabular-nums">
                    {filtered.length}/{prs.length}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[
                    { key: 'all' as const, label: 'All', count: prs.length, dot: '' },
                    {
                      key: 'current' as const,
                      label: 'OK',
                      count: currentCount,
                      dot: 'bg-success',
                    },
                    { key: 'stale' as const, label: 'Stale', count: staleCount, dot: 'bg-warning' },
                    { key: 'dead' as const, label: 'Dead', count: deadCount, dot: 'bg-error' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      className={`btn btn-xs gap-1 rounded-lg h-6 min-h-0 text-[10px] ${filter === f.key ? 'btn-neutral' : 'btn-ghost text-base-content/40'}`}
                      onClick={() => setFilter(filter === f.key && f.key !== 'all' ? 'all' : f.key)}
                    >
                      {f.dot && <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}
                      {f.label} <span className="opacity-50">{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-base-200 overflow-hidden divide-y divide-base-200/50">
                {filtered.map((pr) => {
                  const s = staleness(pr, mainShas[pr.repo]);
                  const qItem = queue.find((q) => q.pr_number === pr.number && q.repo === pr.repo);
                  const agent = AGENT[pr.agentType];
                  const isDead = s === 'dead';
                  const health = pr.detail ? computeHealthScore(pr, mainShas[pr.repo]) : null;
                  const d = pr.detail;
                  return (
                    <div
                      key={`${pr.repo}-${pr.number}`}
                      className="group px-2.5 py-2 hover:bg-base-200/20 transition-all relative"
                    >
                      <div
                        className={`absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full transition-opacity ${
                          s === 'current' ? 'bg-success' : isDead ? 'bg-error' : 'bg-warning'
                        } opacity-0 group-hover:opacity-100`}
                      />
                      <div className="flex items-center gap-2 text-sm">
                        {health ? (
                          <div
                            className={`flex items-center justify-center w-6 h-6 rounded text-[10px] font-black shrink-0 ${GRADE_COLORS[health.grade]}`}
                            title={`${health.score}/100`}
                          >
                            {health.grade}
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded bg-base-200 animate-pulse shrink-0" />
                        )}
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            s === 'current' ? 'bg-success' : isDead ? 'bg-error' : 'bg-warning'
                          }`}
                        />
                        <span className="text-sm">{agent.emoji}</span>
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noopener"
                          className="flex-1 min-w-0 hover:underline truncate text-xs leading-tight"
                        >
                          <span className="font-mono text-[10px] text-base-content/20">
                            #{pr.number}
                          </span>{' '}
                          <span className="text-base-content/70">{pr.title}</span>
                        </a>
                        {qItem ? (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                              qItem.state === 'active'
                                ? 'bg-info/15 text-info'
                                : qItem.state === 'queued'
                                  ? 'bg-warning/15 text-warning'
                                  : 'bg-success/15 text-success'
                            }`}
                          >
                            {qItem.state}
                          </span>
                        ) : s !== 'current' ? (
                          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="btn btn-xs btn-ghost text-primary rounded h-5 min-h-0 text-[10px]"
                              onClick={() => queuePR(pr)}
                              disabled={actionLoading === `q-${pr.number}`}
                            >
                              Queue
                            </button>
                            {isDead && (
                              <button
                                className="btn btn-xs btn-ghost text-error rounded h-5 min-h-0 text-[10px]"
                                onClick={() => agentAutoClose(pr)}
                                disabled={agentBusy}
                              >
                                Close
                              </button>
                            )}
                          </div>
                        ) : null}
                        <span className="text-[9px] text-base-content/20 tabular-nums shrink-0">
                          {formatAge(pr.createdAt)}
                        </span>
                      </div>
                      {d && (
                        <div className="flex items-center gap-1 mt-1 ml-8 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-medium ${
                              d.reviewStatus === 'APPROVED'
                                ? 'bg-success/15 text-success'
                                : d.reviewStatus === 'CHANGES_REQUESTED'
                                  ? 'bg-error/15 text-error'
                                  : d.reviewStatus === 'PENDING'
                                    ? 'bg-warning/15 text-warning'
                                    : 'bg-base-200 text-base-content/25'
                            }`}
                          >
                            {d.reviewStatus === 'APPROVED' && (
                              <>
                                <ThumbsUp size={8} /> Approved
                              </>
                            )}
                            {d.reviewStatus === 'CHANGES_REQUESTED' && (
                              <>
                                <ThumbsDown size={8} /> Changes
                              </>
                            )}
                            {d.reviewStatus === 'PENDING' && (
                              <>
                                <Eye size={8} /> Pending
                              </>
                            )}
                            {d.reviewStatus === 'NO_REVIEWS' && (
                              <>
                                <MessageSquare size={8} /> None
                              </>
                            )}
                          </span>
                          {d.draft && (
                            <span className="px-1 py-0 rounded text-[9px] font-medium bg-base-200 text-base-content/30">
                              Draft
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-medium ${sizeColor(d.additions, d.deletions)}`}
                          >
                            <FileCode size={8} /> {formatSize(d.additions, d.deletions)}
                          </span>
                          <span className="text-[9px] text-base-content/15 font-mono ml-auto">
                            {pr.repo.split('/')[1]}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filtered.length === 0 && prs.length > 0 && (
                  <div className="py-4 text-center text-xs text-base-content/30">
                    No {filter} PRs
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* ━━━ Queue ━━━ */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <h2 className="section-title text-xs">Queue</h2>
              <span className="text-[9px] font-mono text-base-content/25 bg-base-200/60 px-1.5 py-0.5 rounded">
                {queued.length}
              </span>
            </div>
            {unqueuedStaleCount > 0 && (
              <button
                className="btn btn-xs gap-1 btn-outline btn-primary rounded-lg h-6 min-h-0 text-[10px]"
                onClick={queueAllStale}
                disabled={actionLoading === 'queue-all'}
              >
                <TrendingUp size={10} /> Queue {unqueuedStaleCount}
              </button>
            )}
          </div>
          {queued.length === 0 ? (
            <div className="rounded-lg border border-dashed border-base-300 py-6 text-center">
              <p className="text-[11px] text-base-content/25">Empty — all caught up</p>
            </div>
          ) : (
            <div className="space-y-1">
              {queued.map((q, i) => {
                const pr = prs.find((p) => p.number === q.pr_number && p.repo === q.repo);
                const agent = pr ? AGENT[pr.agentType] : AGENT.other;
                const canActivate = !activePR;
                const isNext = i === 0 && canActivate;
                const pMeta = PRIORITY_META[q.priority] || PRIORITY_META[0];
                return (
                  <div
                    key={q.id}
                    className={`queue-item flex items-center gap-2 px-3 py-2 rounded-lg border ${
                      isNext
                        ? 'bg-info/5 border-info/20'
                        : 'bg-base-200/30 border-transparent hover:border-base-300'
                    }`}
                  >
                    <span className="text-base-content/20 font-mono text-[10px] w-3 text-center font-bold tabular-nums">
                      {i + 1}
                    </span>
                    <span className="text-sm">{agent.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={pr?.url || '#'}
                        target="_blank"
                        rel="noopener"
                        className="text-xs font-medium hover:underline truncate block leading-tight"
                      >
                        <span className="text-base-content/20 font-mono text-[10px]">
                          #{q.pr_number}
                        </span>{' '}
                        {pr?.title || q.notes || ''}
                      </a>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-base-content/30 font-mono">
                          {q.repo.split('/')[1]}
                        </span>
                        <span
                          className={`inline-flex items-center gap-0.5 px-1 rounded text-[9px] font-medium border ${pMeta.color}`}
                        >
                          {pMeta.icon} {pMeta.label}
                        </span>
                        {isNext && (
                          <span className="text-[9px] font-bold text-info uppercase tracking-wider">
                            next →
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        className="btn btn-xs btn-ghost btn-square opacity-30 hover:opacity-100 h-5 w-5 min-h-0"
                        onClick={() => changePriority(q, 1)}
                        disabled={q.priority >= 3}
                        title="Priority up"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        className="btn btn-xs btn-ghost btn-square opacity-30 hover:opacity-100 h-5 w-5 min-h-0"
                        onClick={() => changePriority(q, -1)}
                        disabled={q.priority <= 0}
                        title="Priority down"
                      >
                        <ChevronDown size={12} />
                      </button>
                      {canActivate && (
                        <button
                          className="btn btn-xs btn-info gap-0.5 ml-0.5 rounded h-5 min-h-0 text-[10px]"
                          onClick={() => agentActivatePR(q)}
                          disabled={agentBusy}
                        >
                          <Play size={9} /> Go
                        </button>
                      )}
                      <button
                        className="btn btn-xs btn-ghost btn-square opacity-15 hover:opacity-100 hover:text-error h-5 w-5 min-h-0"
                        onClick={() => removeFromQueue(q)}
                        title="Remove"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ━━━ Activity Log (compact) ━━━ */}
        {activityLog.length > 0 && (
          <section>
            <h2 className="section-title text-xs mb-1.5">Activity</h2>
            <div className="rounded-lg border border-base-200 overflow-hidden divide-y divide-base-200/50">
              {activityLog.slice(0, 8).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 py-1.5 px-2.5 text-xs hover:bg-base-200/20 transition-colors"
                >
                  <span className="text-base-content/30 shrink-0">
                    {(ACTION_META[entry.action] || defaultActionMeta).icon}
                  </span>
                  <span className="font-mono text-[9px] text-base-content/15">
                    #{entry.pr_number}
                  </span>
                  <span className="text-[11px] font-medium text-base-content/50">
                    {entry.action}
                  </span>
                  {entry.details && (
                    <span className="text-[10px] text-base-content/25 truncate flex-1">
                      — {entry.details}
                    </span>
                  )}
                  {!entry.details && <span className="flex-1" />}
                  <span className="text-[9px] text-base-content/15 tabular-nums shrink-0">
                    {formatAge(entry.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ━━━ History ━━━ */}
        {resolved.length > 0 && (
          <HistorySection
            items={resolved}
            onRemove={removeFromQueue}
            onBulkDelete={bulkDelete}
            onArchive={archiveItem}
            onBulkArchive={bulkArchive}
          />
        )}

        {/* ━━━ Jules Audit ━━━ */}
        <JulesAuditPanel />

        {/* Footer */}
        <footer className="text-[9px] text-base-content/15 text-center py-4 flex items-center justify-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-success/30 animate-pulse-soft" />
          <span className="uppercase tracking-[0.12em] font-medium text-base-content/20">
            Live · {selectedRepos.length} repos · {resolved.length} resolved
          </span>
          <span className="w-1 h-1 rounded-full bg-success/30 animate-pulse-soft" />
        </footer>
      </main>
    </div>
  );
}

/* ━━━ Active Session Card ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const ActiveSessionCard: React.FC<{
  item: QueueItem | undefined;
  prs: PullRequest[];
  logEntries: ActivityLogEntry[];
  onResolve: (item: QueueItem, resolution: string) => void;
  onSkip: (item: QueueItem) => void;
  onFail: (item: QueueItem) => void;
  onCheckStatus: (item: QueueItem) => void;
  onRePing: (item: QueueItem) => void;
  actionLoading: string | null;
  agentBusy: boolean;
}> = ({
  item,
  prs,
  logEntries,
  onResolve,
  onSkip,
  onFail,
  onCheckStatus,
  onRePing,
  actionLoading,
  agentBusy,
}) => {
  const [resolveOpen, setResolveOpen] = useState(false);

  if (!item)
    return (
      <div className="rounded-xl border border-dashed border-base-300/60 py-14 text-center bg-gradient-to-b from-base-200/20 to-transparent relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-info/5 blur-3xl" />
        </div>
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-base-200/60 flex items-center justify-center mx-auto mb-4 ring-1 ring-base-200">
            <Play size={24} className="text-base-content/15 ml-0.5" />
          </div>
          <p className="font-bold text-base-content/40 text-lg">No active session</p>
          <p className="text-xs text-base-content/25 mt-1.5 max-w-[18rem] mx-auto leading-relaxed">
            Activate a PR from the queue below to start a Jules rebase conversation
          </p>
        </div>
      </div>
    );

  const pr = prs.find((p) => p.number === item.pr_number && p.repo === item.repo);
  const agent = pr ? AGENT[pr.agentType] : AGENT.other;
  const busy = actionLoading?.includes(String(item.id)) || false;

  return (
    <div className="animate-fade-in rounded-xl overflow-hidden border border-info/20 bg-gradient-to-b from-info/5 to-transparent">
      {/* Header */}
      <div className="px-5 pt-5 pb-0">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-info/10 flex items-center justify-center text-xl shrink-0 ring-1 ring-info/20">
            {agent.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-info/15 text-info">
                <Circle size={5} className="fill-current animate-pulse-soft" /> Active Session
              </span>
              <span className="text-[10px] text-base-content/25 font-mono">
                {item.repo.split('/')[1]}
              </span>
            </div>
            <a
              href={pr?.url || '#'}
              target="_blank"
              rel="noopener"
              className="text-[15px] font-bold hover:underline leading-snug flex items-center gap-1.5 group"
            >
              <Hash size={13} className="text-base-content/25 shrink-0" />
              {item.pr_number} {pr?.title || item.notes || 'Unknown PR'}
              <ExternalLink
                size={11}
                className="opacity-0 group-hover:opacity-40 shrink-0 transition-opacity"
              />
            </a>
            {pr && (
              <p className="text-[11px] text-base-content/30 mt-1.5 flex items-center gap-1.5">
                <Clock size={10} /> Opened {formatAge(pr.createdAt)} ago
                <span className="text-base-content/15">·</span>
                <code className="text-[10px] bg-base-200 px-1 py-0 rounded">{pr.headBranch}</code>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Ping Progress */}
      <div className="px-5 py-4">
        <div className="rounded-lg bg-base-100/60 border border-base-200/80 p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold text-base-content/45 flex items-center gap-1.5 uppercase tracking-wider">
              <Bell size={11} /> Ping Progress
            </span>
            <span className="text-[11px] font-bold font-mono text-base-content/30">
              {item.ping_count} / 3
            </span>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    i < item.ping_count
                      ? i === 0
                        ? 'bg-info'
                        : i === 1
                          ? 'bg-info/60'
                          : 'bg-warning'
                      : 'bg-base-200'
                  }`}
                />
                <span className="text-[9px] text-base-content/20 mt-1.5 block text-center font-medium">
                  {['Initial', 'Follow-up', 'Final'][i]}
                </span>
              </div>
            ))}
          </div>
          {item.first_pinged_at && (
            <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-base-200/60 text-[11px] text-base-content/30">
              <Clock size={10} />
              First ping: {new Date(item.first_pinged_at).toLocaleDateString()}
              {item.last_pinged_at &&
                item.last_pinged_at !== item.first_pinged_at &&
                ` · Latest: ${new Date(item.last_pinged_at).toLocaleDateString()}`}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-4">
        <div className="flex gap-2 flex-wrap">
          <button
            className="btn btn-sm btn-info gap-1.5 rounded-lg"
            onClick={() => onCheckStatus(item)}
            disabled={agentBusy}
          >
            {agentBusy ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Search size={13} />
            )}
            Check Status
          </button>
          {item.ping_count < 3 && (
            <button
              className="btn btn-sm btn-outline btn-info gap-1.5 rounded-lg"
              onClick={() => onRePing(item)}
              disabled={agentBusy}
            >
              <Bell size={13} /> Re-ping ({item.ping_count + 1}/3)
            </button>
          )}
          <div className="flex-1" />
          {!resolveOpen ? (
            <div className="flex gap-1.5">
              <button
                className="btn btn-sm btn-success gap-1 rounded-lg"
                onClick={() => setResolveOpen(true)}
                disabled={busy}
              >
                <CheckCircle size={13} /> Resolve
              </button>
              <button
                className="btn btn-sm btn-ghost rounded-lg opacity-50 hover:opacity-100"
                onClick={() => onSkip(item)}
                disabled={busy}
                title="Skip this PR"
                aria-label="Skip this PR"
              >
                <SkipForward size={13} />
              </button>
              <button
                className="btn btn-sm btn-ghost rounded-lg opacity-50 hover:opacity-100"
                onClick={() => onFail(item)}
                disabled={busy}
                title="Mark as failed"
                aria-label="Mark as failed"
              >
                <XCircle size={13} />
              </button>
            </div>
          ) : (
            <div className="flex gap-1.5 animate-fade-in">
              {(
                [
                  {
                    key: 'merged',
                    label: 'Merged',
                    cls: 'btn-success',
                    icon: <GitMerge size={11} />,
                  },
                  {
                    key: 'rebased',
                    label: 'Rebased',
                    cls: 'btn-info',
                    icon: <RotateCcw size={11} />,
                  },
                  {
                    key: 'closed',
                    label: 'Closed',
                    cls: 'btn-warning',
                    icon: <Archive size={11} />,
                  },
                  {
                    key: 'manually-resolved',
                    label: 'Manual',
                    cls: 'btn-ghost',
                    icon: <CheckCircle size={11} />,
                  },
                ] as const
              ).map((r) => (
                <button
                  key={r.key}
                  className={`btn btn-xs ${r.cls} gap-1 rounded-lg`}
                  onClick={() => {
                    onResolve(item, r.key);
                    setResolveOpen(false);
                  }}
                  disabled={busy}
                >
                  {r.icon} {r.label}
                </button>
              ))}
              <button
                className="btn btn-xs btn-ghost rounded-lg"
                onClick={() => setResolveOpen(false)}
              >
                <X size={11} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      {logEntries.length > 0 && (
        <div className="border-t border-info/10 bg-base-100/30 px-5 py-4">
          <h3 className="section-title mb-3">Session Timeline</h3>
          <div className="relative pl-5">
            <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-base-300/50" />
            {logEntries.map((entry, i) => (
              <div key={entry.id} className="relative flex items-start gap-2.5 pb-3 last:pb-0">
                <div
                  className={`absolute left-[-13px] mt-1 w-2 h-2 rounded-full ring-2 ring-base-100 ${
                    i === 0 ? 'bg-info' : 'bg-base-300'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base-content/40">
                      {ACTION_META[entry.action]?.icon || <Clock size={13} />}
                    </span>
                    <span className="text-sm font-medium">{entry.action}</span>
                    <span className="text-[10px] text-base-content/20 ml-auto tabular-nums">
                      {formatAge(entry.created_at)}
                    </span>
                  </div>
                  {entry.details && (
                    <p className="text-xs text-base-content/35 mt-0.5 ml-[1.375rem]">
                      {entry.details}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation Panel */}
      <ConversationPanel
        prNumber={item.pr_number}
        repo={item.repo}
        prUrl={pr?.url || `https://github.com/${item.repo}/pull/${item.pr_number}`}
        agentBusy={agentBusy}
      />
    </div>
  );
};

/* ━━━ History Section ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ━━━ Activity Heat Map ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const ActivityHeatMap: React.FC<{ items: QueueItem[] }> = ({ items }) => {
  const weeks = 16;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (weeks * 7 - 1) - startDate.getDay());

  // Count events per day (use resolved_at or created_at)
  const counts = useMemo(() => {
    const map: Record<string, { resolved: number; created: number }> = {};
    items.forEach((q) => {
      if (q.resolved_at) {
        const d = new Date(q.resolved_at).toISOString().slice(0, 10);
        if (!map[d]) map[d] = { resolved: 0, created: 0 };
        map[d].resolved++;
      }
      if (q.created_at) {
        const d = new Date(q.created_at).toISOString().slice(0, 10);
        if (!map[d]) map[d] = { resolved: 0, created: 0 };
        map[d].created++;
      }
    });
    return map;
  }, [items]);

  // Build grid: array of weeks, each with 7 days
  const grid = useMemo(() => {
    const result: { date: Date; key: string; count: number }[][] = [];
    const cursor = new Date(startDate);
    for (let w = 0; w < weeks; w++) {
      const week: (typeof result)[0] = [];
      for (let d = 0; d < 7; d++) {
        const key = cursor.toISOString().slice(0, 10);
        const c = counts[key];
        week.push({ date: new Date(cursor), key, count: c ? c.resolved + c.created : 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
      result.push(week);
    }
    return result;
  }, [counts, startDate]);

  const maxCount = Math.max(
    1,
    ...Object.values(counts).map(
      (c: { resolved: number; created: number }) => c.resolved + c.created,
    ),
  );

  const getColor = (count: number): string => {
    if (count === 0) return 'bg-base-200/50';
    const ratio = count / maxCount;
    if (ratio <= 0.25) return 'bg-success/25';
    if (ratio <= 0.5) return 'bg-success/45';
    if (ratio <= 0.75) return 'bg-success/65';
    return 'bg-success/90';
  };

  const [tooltip, setTooltip] = useState<{ key: string; x: number; y: number } | null>(null);
  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    grid.forEach((week, wi) => {
      const m = week[0].date.getMonth();
      if (m !== lastMonth) {
        labels.push({ label: week[0].date.toLocaleString('en', { month: 'short' }), col: wi });
        lastMonth = m;
      }
    });
    return labels;
  }, [grid]);

  return (
    <div className="rounded-lg border border-base-200/80 bg-base-100/40 p-3">
      <div className="flex items-center gap-2 mb-2">
        <CalendarDays size={12} className="text-base-content/30" />
        <span className="text-[11px] font-semibold text-base-content/40 uppercase tracking-wider">
          Session Activity
        </span>
        <span className="text-[10px] text-base-content/20 ml-auto">
          {items.length} total sessions
        </span>
      </div>
      <div className="relative overflow-x-auto">
        {/* Month labels */}
        <div className="flex ml-6 mb-0.5 relative h-3">
          {monthLabels.map((m, i) => (
            <span
              key={i}
              className="text-[9px] text-base-content/25 font-medium absolute"
              style={{ left: `${m.col * 13}px` }}
            >
              {m.label}
            </span>
          ))}
        </div>
        <div className="flex gap-[2px]">
          {/* Day labels */}
          <div className="flex flex-col gap-[2px] mr-0.5 shrink-0">
            {dayLabels.map((l, i) => (
              <div
                key={i}
                className="h-[11px] w-4 text-[8px] text-base-content/20 text-right pr-0.5 leading-[11px]"
              >
                {l}
              </div>
            ))}
          </div>
          {/* Grid */}
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {week.map((day) => {
                const isToday = day.key === today.toISOString().slice(0, 10);
                const isFuture = day.date > today;
                return (
                  <div
                    key={day.key}
                    className={`w-[11px] h-[11px] rounded-[2px] transition-all cursor-pointer ${
                      isFuture ? 'bg-transparent' : getColor(day.count)
                    } ${isToday ? 'ring-1 ring-primary/40' : ''}`}
                    onMouseEnter={(e) => setTooltip({ key: day.key, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-2 justify-end">
          <span className="text-[9px] text-base-content/20">Less</span>
          {[
            'bg-base-200/50',
            'bg-success/25',
            'bg-success/45',
            'bg-success/65',
            'bg-success/90',
          ].map((c, i) => (
            <div key={i} className={`w-[9px] h-[9px] rounded-[2px] ${c}`} />
          ))}
          <span className="text-[9px] text-base-content/20">More</span>
        </div>
      </div>
      {/* Tooltip */}
      {tooltip && counts[tooltip.key] && (
        <div
          className="fixed z-50 bg-neutral text-neutral-content text-[11px] px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none"
          style={{ left: tooltip.x + 10, top: tooltip.y - 30 }}
        >
          <div className="font-semibold">
            {new Date(tooltip.key + 'T12:00:00').toLocaleDateString('en', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
          <div className="text-neutral-content/70">
            {counts[tooltip.key].resolved > 0 && `${counts[tooltip.key].resolved} resolved`}
            {counts[tooltip.key].resolved > 0 && counts[tooltip.key].created > 0 && ' · '}
            {counts[tooltip.key].created > 0 && `${counts[tooltip.key].created} created`}
          </div>
        </div>
      )}
    </div>
  );
};

/* ━━━ History Section ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const HistorySection: React.FC<{
  items: QueueItem[];
  onRemove: (item: QueueItem) => void;
  onBulkDelete: (ids: number[]) => void;
  onArchive: (item: QueueItem) => void;
  onBulkArchive: (ids: number[]) => void;
}> = ({ items, onRemove, onBulkDelete, onArchive, onBulkArchive }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmAction, setConfirmAction] = useState<
    'delete-selected' | 'delete-all' | 'archive-selected' | null
  >(null);
  const [filterRes, setFilterRes] = useState('all');
  const [sortBy, setSortBy] = useState<'resolved' | 'created' | 'age'>('resolved');
  const archived = items.filter((q) => q.state === 'archived');
  const nonArchived = items.filter((q) => q.state !== 'archived');
  const [showArchived, setShowArchived] = useState(false);
  const displayItems = showArchived ? archived : nonArchived;
  const filtered = useMemo(() => {
    let list =
      filterRes === 'all' ? displayItems : displayItems.filter((q) => q.resolution === filterRes);
    list = [...list].sort((a, b) => {
      if (sortBy === 'resolved') {
        return (b.resolved_at || '').localeCompare(a.resolved_at || '');
      } else if (sortBy === 'created') {
        return (b.created_at || '').localeCompare(a.created_at || '');
      } else {
        return (a.created_at || '').localeCompare(b.created_at || '');
      }
    });
    return list;
  }, [displayItems, filterRes, sortBy]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((q) => q.id)));
    }
  };
  const clearSelection = () => setSelected(new Set());

  const executeAction = () => {
    if (confirmAction === 'delete-selected') {
      onBulkDelete(Array.from(selected));
      clearSelection();
    } else if (confirmAction === 'delete-all') {
      onBulkDelete(filtered.map((q) => q.id));
      clearSelection();
    } else if (confirmAction === 'archive-selected') {
      onBulkArchive(Array.from(selected));
      clearSelection();
    }
    setConfirmAction(null);
  };

  const resolutions = Array.from(new Set(displayItems.map((q) => q.resolution).filter(Boolean)));

  const durationStr = (created: string, resolved: string | null): string => {
    if (!resolved) return '\u2014';
    const ms = new Date(resolved).getTime() - new Date(created).getTime();
    const hrs = Math.floor(ms / 3600000);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `${days}d ${hrs % 24}h`;
    if (hrs > 0) return `${hrs}h`;
    const mins = Math.floor(ms / 60000);
    return mins > 0 ? `${mins}m` : '<1m';
  };

  const dateStr = (d: string | null): string => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  };

  return (
    <section className="animate-fade-in">
      <button
        className="flex items-center gap-2 group cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <h2 className="section-title">History</h2>
        <span className="text-xs font-mono text-base-content/25">{nonArchived.length}</span>
        {archived.length > 0 && (
          <span className="text-[10px] text-base-content/20">({archived.length} archived)</span>
        )}
        <ChevronRight
          size={12}
          className={`text-base-content/25 transition-transform duration-200 ${
            open ? 'rotate-90' : ''
          }`}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Heat Map */}
          <ActivityHeatMap items={items} />

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Archive/Active toggle */}
            <div className="flex gap-0.5 bg-base-200 rounded-lg p-0.5">
              <button
                className={`btn btn-xs rounded-md ${!showArchived ? 'btn-neutral' : 'btn-ghost text-base-content/50'}`}
                onClick={() => {
                  setShowArchived(false);
                  clearSelection();
                  setFilterRes('all');
                }}
              >
                Active <span className="text-[10px] opacity-50">{nonArchived.length}</span>
              </button>
              <button
                className={`btn btn-xs rounded-md ${showArchived ? 'btn-neutral' : 'btn-ghost text-base-content/50'}`}
                onClick={() => {
                  setShowArchived(true);
                  clearSelection();
                  setFilterRes('all');
                }}
              >
                <Archive size={11} /> Archived{' '}
                <span className="text-[10px] opacity-50">{archived.length}</span>
              </button>
            </div>

            {/* Resolution filter */}
            {resolutions.length > 1 && (
              <select
                className="select select-xs select-bordered rounded-lg text-[11px] bg-base-100"
                value={filterRes}
                onChange={(e) => {
                  setFilterRes(e.target.value);
                  clearSelection();
                }}
              >
                <option value="all">All resolutions</option>
                {resolutions.map((r) => (
                  <option key={r} value={r || ''}>
                    {r || 'none'}
                  </option>
                ))}
              </select>
            )}

            {/* Sort */}
            <select
              className="select select-xs select-bordered rounded-lg text-[11px] bg-base-100"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="resolved">Newest resolved</option>
              <option value="created">Newest created</option>
              <option value="age">Oldest first</option>
            </select>

            <div className="flex-1" />

            {/* Bulk actions */}
            {selected.size > 0 && (
              <div className="flex gap-1 animate-fade-in">
                {!showArchived && (
                  <button
                    className="btn btn-xs gap-1 btn-outline rounded-lg"
                    onClick={() => setConfirmAction('archive-selected')}
                  >
                    <Archive size={11} /> Archive {selected.size}
                  </button>
                )}
                <button
                  className="btn btn-xs gap-1 btn-outline btn-error rounded-lg"
                  onClick={() => setConfirmAction('delete-selected')}
                >
                  <Trash2 size={11} /> Delete {selected.size}
                </button>
              </div>
            )}
            {filtered.length > 0 && selected.size === 0 && (
              <button
                className="btn btn-xs btn-ghost text-error/50 hover:text-error rounded-lg gap-1"
                onClick={() => setConfirmAction('delete-all')}
              >
                <Trash2 size={11} /> Clear {showArchived ? 'archived' : 'all'}
              </button>
            )}
          </div>

          {/* Confirmation dialog */}
          {confirmAction && (
            <div className="rounded-lg border border-error/30 bg-error/5 p-3 flex items-center gap-3 animate-fade-in">
              <AlertTriangle size={16} className="text-error shrink-0" />
              <span className="text-sm flex-1">
                {confirmAction === 'delete-all'
                  ? `Permanently delete ${filtered.length} ${showArchived ? 'archived' : ''} items?`
                  : confirmAction === 'delete-selected'
                    ? `Permanently delete ${selected.size} selected items?`
                    : `Archive ${selected.size} selected items?`}
              </span>
              <button
                className="btn btn-xs btn-ghost rounded-lg"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </button>
              <button
                className={`btn btn-xs rounded-lg ${confirmAction.includes('archive') ? 'btn-neutral' : 'btn-error'}`}
                onClick={executeAction}
              >
                {confirmAction.includes('archive') ? 'Archive' : 'Delete'}
              </button>
            </div>
          )}

          {/* Select all */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                className="checkbox checkbox-xs"
                checked={selected.size === filtered.length && filtered.length > 0}
                onChange={toggleAll}
              />
              <span
                className="text-[11px] text-base-content/30 cursor-pointer select-none"
                onClick={toggleAll}
              >
                {selected.size === filtered.length ? 'Deselect all' : 'Select all'}
              </span>
              {selected.size > 0 && selected.size < filtered.length && (
                <span className="text-[10px] text-base-content/20">{selected.size} selected</span>
              )}
            </div>
          )}

          {/* Items */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-base-300 py-8 text-center">
              <p className="text-sm text-base-content/30">
                {showArchived ? 'No archived sessions' : 'No history yet'}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-base-200 overflow-hidden divide-y divide-base-200/80">
              {/* Column headers */}
              <div className="flex items-center gap-2.5 px-3 py-1.5 bg-base-200/40 text-[9px] font-semibold text-base-content/30 uppercase tracking-wider">
                <div className="w-4 shrink-0" />
                <div className="w-4 shrink-0" />
                <div className="w-10 shrink-0">PR</div>
                <div className="w-20 shrink-0">Repo</div>
                <div className="flex-1">Resolution</div>
                <div className="w-14 text-right shrink-0 hidden sm:block">Created</div>
                <div className="w-14 text-right shrink-0 hidden sm:block">Resolved</div>
                <div className="w-10 text-right shrink-0 hidden sm:block">Dur.</div>
                <div className="w-10 text-right shrink-0">Age</div>
                <div className="w-14 shrink-0" />
              </div>
              {filtered.map((q) => {
                const res = resolutionInfo(q.resolution);
                const isSelected = selected.has(q.id);
                const ageDays = q.created_at ? daysSince(q.created_at) : 0;
                const ageColor =
                  ageDays > 90
                    ? 'text-error/60'
                    : ageDays > 30
                      ? 'text-warning/60'
                      : 'text-base-content/25';
                return (
                  <div
                    key={q.id}
                    className={`animate-fade-in flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                      isSelected ? 'bg-primary/5' : 'hover:bg-base-200/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs shrink-0"
                      checked={isSelected}
                      onChange={() => toggleSelect(q.id)}
                    />
                    <span className="shrink-0">
                      {q.state === 'skipped' ? '\u23ed\ufe0f' : res.emoji}
                    </span>
                    <span className="font-mono text-[11px] text-base-content/25 w-10 shrink-0">
                      #{q.pr_number}
                    </span>
                    <span className="text-base-content/35 text-xs w-20 truncate shrink-0">
                      {q.repo.split('/')[1]}
                    </span>
                    <span className="flex-1 text-xs text-base-content/45 truncate">
                      {res.label}
                    </span>
                    <span className="text-[10px] text-base-content/20 tabular-nums w-14 text-right shrink-0 hidden sm:block">
                      {dateStr(q.created_at)}
                    </span>
                    <span className="text-[10px] text-base-content/20 tabular-nums w-14 text-right shrink-0 hidden sm:block">
                      {dateStr(q.resolved_at)}
                    </span>
                    <span
                      className="text-[10px] text-base-content/20 tabular-nums w-10 text-right shrink-0 hidden sm:block"
                      title="Time from queued to resolved"
                    >
                      {durationStr(q.created_at, q.resolved_at)}
                    </span>
                    <span
                      className={`text-[10px] tabular-nums w-10 text-right shrink-0 font-medium ${ageColor}`}
                    >
                      {q.created_at ? formatAge(q.created_at) : '\u2014'}
                    </span>
                    <div className="flex gap-0.5 shrink-0">
                      {!showArchived ? (
                        <button
                          className="btn btn-xs btn-ghost btn-square opacity-20 hover:opacity-100"
                          onClick={() => onArchive(q)}
                          title="Archive"
                          aria-label="Archive session"
                        >
                          <Archive size={11} />
                        </button>
                      ) : null}
                      <button
                        className="btn btn-xs btn-ghost btn-square opacity-20 hover:opacity-100 hover:text-error"
                        onClick={() => onRemove(q)}
                        title="Delete permanently"
                        aria-label="Delete session"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
