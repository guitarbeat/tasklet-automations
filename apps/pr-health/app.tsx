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
} from 'lucide-react';
import { PullRequest, QueueItem, RepoHealth, ActivityLogEntry } from './types';
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
} from './utils/helpers';

/* ─── Constants ─────────────────────────────────────────────── */
const REPOS = ['guitarbeat/bledsoe-mobile-notary', 'guitarbeat/PhD-Writing'];
const api = window.tasklet;

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
  const [view, setView] = useState<'session' | 'overview'>('session');
  const [filter, setFilter] = useState<'all' | 'current' | 'stale' | 'dead'>('all');
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    msg: string;
    onConfirm: () => void;
  } | null>(null);

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

  const agentRunScan = () =>
    askAgent(
      'Run a full stale PR scan now — check all repos for stale/dead PRs, update the jules_queue, and report back what you found. Show the PR Health dashboard when done.',
      'Running full scan',
    );
  const agentActivatePR = (item: QueueItem) =>
    askAgent(
      `Activate PR #${item.pr_number} in ${item.repo} — update jules_queue to set it as active, then post a @jules rebase comment on the PR on GitHub. Log the action to jules_activity_log. Show the PR Health dashboard when done.`,
      `Activating #${item.pr_number}`,
    );
  const agentCheckStatus = (item: QueueItem) =>
    askAgent(
      `Check the status of the active PR #${item.pr_number} in ${item.repo} — look at the PR on GitHub to see if it's been merged, rebased, or if Jules responded. Update jules_queue accordingly, log to jules_activity_log, and report back. Show the PR Health dashboard when done.`,
      `Checking #${item.pr_number}`,
    );
  const agentPingJules = (item: QueueItem) =>
    askAgent(
      `Re-ping Jules on the active PR #${item.pr_number} in ${item.repo} — post another @jules comment asking for a status update on the rebase. Update ping_count in jules_queue. Log to jules_activity_log. Show the PR Health dashboard when done.`,
      `Re-pinging Jules on #${item.pr_number}`,
    );
  const agentAutoClose = (pr: PullRequest) =>
    askAgent(
      `PR #${pr.number} in ${pr.repo} has been dead for ${daysSince(pr.createdAt)} days. Post an advisory comment explaining it will be auto-closed due to inactivity, then close it. Update jules_queue if tracked. Log to jules_activity_log. Show the PR Health dashboard when done.`,
      `Auto-closing #${pr.number}`,
    );

  /* ─── Data loading ─────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allPrs: PullRequest[] = [];
      const shas: Record<string, string> = {};
      const results = await Promise.all(
        REPOS.map(async (repo) => {
          const [owner, name] = repo.split('/');
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

      const qRes = await api.sqlQuery(
        "SELECT * FROM jules_queue ORDER BY CASE state WHEN 'active' THEN 0 WHEN 'queued' THEN 1 WHEN 'resolved' THEN 2 WHEN 'failed' THEN 3 ELSE 4 END, priority DESC, created_at ASC",
      );
      setQueue(Array.isArray(qRes) ? (qRes as unknown as QueueItem[]) : []);

      try {
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
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  /* ─── Derived state ────────────────────────────────────────── */
  const activePR = queue.find((q) => q.state === 'active');
  const queued = queue
    .filter((q) => q.state === 'queued')
    .sort((a, b) => b.priority - a.priority || a.id - b.id);
  const resolved = queue.filter(
    (q) => q.state === 'resolved' || q.state === 'failed' || q.state === 'skipped',
  );
  const repos: RepoHealth[] = REPOS.map((r) => repoHealth(prs, r, mainShas[r] || ''));
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

      {/* ━━━ Sticky Header ━━━ */}
      <header className="sticky top-0 z-40 bg-base-100/90 backdrop-blur-md border-b border-base-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">Jules Pipeline</h1>
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  activePR ? 'bg-info/15 text-info' : 'bg-base-200 text-base-content/35'
                }`}
              >
                <Circle
                  size={6}
                  className={activePR ? 'fill-current animate-pulse-soft' : 'fill-current'}
                />
                {activePR ? 'Active' : 'Idle'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="join bg-base-200 rounded-lg p-0.5">
              <button
                className={`join-item btn btn-xs border-0 min-w-[4rem] ${view === 'session' ? 'btn-neutral' : 'btn-ghost'}`}
                onClick={() => setView('session')}
              >
                Session
              </button>
              <button
                className={`join-item btn btn-xs border-0 min-w-[4rem] ${view === 'overview' ? 'btn-neutral' : 'btn-ghost'}`}
                onClick={() => setView('overview')}
              >
                Overview
              </button>
            </div>
            <button
              className="btn btn-sm btn-primary gap-1.5 rounded-lg"
              onClick={agentRunScan}
              disabled={agentBusy}
            >
              {agentBusy ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Radar size={14} />
              )}
              Scan
            </button>
            <button
              className="btn btn-sm btn-ghost btn-square rounded-lg"
              onClick={load}
              title="Refresh data"
              aria-label="Refresh data"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        {/* Stats bar */}
        <div className="max-w-3xl mx-auto px-4 pb-3 flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-base-200/60">
            <GitMerge size={13} className="opacity-50" />
            <span className="font-bold tabular-nums">{prs.length}</span>
            <span className="text-base-content/50 text-xs">open</span>
          </span>
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${staleCount > 0 ? 'bg-warning/10' : 'bg-base-200/60'}`}
          >
            <AlertTriangle size={13} className={staleCount > 0 ? 'text-warning' : 'opacity-50'} />
            <span className={`font-bold tabular-nums ${staleCount > 0 ? 'text-warning' : ''}`}>
              {staleCount}
            </span>
            <span className="text-base-content/50 text-xs">stale</span>
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-base-200/60">
            <Inbox size={13} className="opacity-50" />
            <span className="font-bold tabular-nums">{queued.length}</span>
            <span className="text-base-content/50 text-xs">queued</span>
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/10">
            <CheckCircle size={13} className="text-success" />
            <span className="font-bold tabular-nums text-success">{resolved.length}</span>
            <span className="text-base-content/50 text-xs">done</span>
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5">
        {view === 'session' ? (
          <div className="space-y-5 stagger">
            {/* ━━━ Lifecycle Stepper ━━━ */}
            <div className="flex items-center gap-0 px-2">
              {LIFECYCLE.map((step, i) => {
                const current = activePR ? lifecycleStep(activePR) : -1;
                const isActive = i === current;
                const isDone = i < current;
                return (
                  <React.Fragment key={step.key}>
                    {i > 0 && (
                      <div
                        className={`flex-1 h-px mx-1 ${
                          isDone
                            ? 'bg-success'
                            : isActive
                              ? 'step-active-line h-0.5'
                              : 'bg-base-300'
                        }`}
                      />
                    )}
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                          isDone
                            ? 'bg-success/15 text-success ring-1 ring-success/30'
                            : isActive
                              ? 'bg-info/15 text-info ring-2 ring-info/30 animate-glow'
                              : 'bg-base-200 text-base-content/20'
                        }`}
                      >
                        {isDone ? <CheckCircle size={15} /> : step.icon}
                      </div>
                      <span
                        className={`text-xs font-bold transition-colors ${
                          isDone ? 'text-success' : isActive ? 'text-info' : 'text-base-content/40'
                        }`}
                      >
                        {step.label}
                      </span>
                      <span
                        className={`text-[10px] leading-tight text-center max-w-[5rem] ${
                          isActive ? 'text-info/60' : 'text-base-content/25'
                        }`}
                      >
                        {step.desc}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* ━━━ Next Action Banner ━━━ */}
            <div
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors ${
                nextAction.urgent
                  ? 'bg-warning/8 border-warning/20'
                  : 'bg-base-200/50 border-base-200'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  nextAction.urgent
                    ? 'bg-warning/15 text-warning'
                    : 'bg-base-300/60 text-base-content/30'
                }`}
              >
                <ArrowRight size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-bold leading-tight ${nextAction.urgent ? 'text-warning' : 'text-base-content/80'}`}
                >
                  Next Step: {nextAction.text}
                </p>
                <p className="text-xs text-base-content/50 mt-0.5 leading-tight">
                  {nextAction.detail}
                </p>
              </div>
              {!activePR && queued.length > 0 && (
                <button
                  className="btn btn-sm btn-info gap-1.5 rounded-lg shrink-0"
                  onClick={() => agentActivatePR(queued[0])}
                  disabled={agentBusy}
                >
                  {agentBusy ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Play size={13} />
                  )}
                  Activate #{queued[0].pr_number}
                </button>
              )}
            </div>

            {/* ━━━ Active Session Card ━━━ */}
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

            {/* ━━━ Up Next Queue ━━━ */}
            <section className="animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="section-title">Queue</h2>
                  <span className="badge badge-sm bg-base-200 text-base-content/50 font-mono">
                    {queued.length}
                  </span>
                  <span className="text-[11px] text-base-content/40 hidden sm:inline">
                    — PRs waiting for Jules rebase
                  </span>
                </div>
                {unqueuedStaleCount > 0 && (
                  <button
                    className="btn btn-xs gap-1 btn-outline btn-primary rounded-lg"
                    onClick={queueAllStale}
                    disabled={actionLoading === 'queue-all'}
                  >
                    <TrendingUp size={12} />
                    Queue {unqueuedStaleCount} stale
                  </button>
                )}
              </div>

              {queued.length === 0 ? (
                <div className="rounded-xl border border-dashed border-base-300 py-10 text-center">
                  <CheckCircle size={24} className="mx-auto text-success/30 mb-2" />
                  <p className="text-sm text-base-content/35 font-medium">
                    Queue is empty — all caught up!
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {queued.map((q, i) => {
                    const pr = prs.find((p) => p.number === q.pr_number && p.repo === q.repo);
                    const agent = pr ? AGENT[pr.agentType] : AGENT.other;
                    const canActivate = !activePR;
                    const isNext = i === 0 && canActivate;
                    const pMeta = PRIORITY_META[q.priority] || PRIORITY_META[0];
                    return (
                      <div
                        key={q.id}
                        className={`queue-item flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-colors ${
                          isNext
                            ? 'bg-info/5 border-info/20'
                            : 'bg-base-200/40 border-transparent hover:border-base-300'
                        }`}
                      >
                        <span className="text-base-content/30 font-mono text-[11px] w-4 text-center font-bold tabular-nums">
                          {i + 1}
                        </span>
                        <span className="text-base">{agent.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <a
                            href={pr?.url || '#'}
                            target="_blank"
                            rel="noopener"
                            className="text-sm font-medium hover:underline truncate block leading-tight"
                          >
                            <span className="text-base-content/30 font-mono text-xs">
                              #{q.pr_number}
                            </span>{' '}
                            {pr?.title || q.notes || ''}
                          </a>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[11px] text-base-content/40 font-mono">
                              {q.repo.split('/')[1]}
                            </span>
                            <span
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[10px] font-medium border ${pMeta.color}`}
                            >
                              {pMeta.icon} {pMeta.label}
                            </span>
                            {isNext && (
                              <span className="text-[10px] font-bold text-info uppercase tracking-wider">
                                next →
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            className="btn btn-xs btn-ghost btn-square opacity-40 hover:opacity-100"
                            onClick={() => changePriority(q, 1)}
                            disabled={q.priority >= 3}
                            title="Priority up"
                            aria-label="Increase priority"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            className="btn btn-xs btn-ghost btn-square opacity-40 hover:opacity-100"
                            onClick={() => changePriority(q, -1)}
                            disabled={q.priority <= 0}
                            title="Priority down"
                            aria-label="Decrease priority"
                          >
                            <ChevronDown size={14} />
                          </button>
                          {canActivate && (
                            <button
                              className="btn btn-xs btn-info gap-1 ml-1 rounded-lg"
                              onClick={() => agentActivatePR(q)}
                              disabled={agentBusy}
                              title="Start a Jules rebase session for this PR"
                            >
                              {agentBusy ? (
                                <span className="loading loading-spinner loading-xs" />
                              ) : (
                                <Play size={11} />
                              )}
                              Activate
                            </button>
                          )}
                          <button
                            className="btn btn-xs btn-ghost btn-square opacity-20 hover:opacity-100 hover:text-error"
                            onClick={() => removeFromQueue(q)}
                            title="Remove from queue"
                            aria-label="Remove from queue"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ━━━ Activity Log ━━━ */}
            {activityLog.length > 0 && (
              <section className="animate-fade-in">
                <h2 className="section-title mb-3">Activity Log</h2>
                <div className="rounded-xl border border-base-200 overflow-hidden divide-y divide-base-200">
                  {activityLog.slice(0, 10).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2.5 py-2 px-3 text-sm bg-base-100 hover:bg-base-200/30 transition-colors"
                    >
                      <span className="text-base-content/40">
                        {ACTION_META[entry.action]?.icon || <Clock size={13} />}
                      </span>
                      <span className="font-mono text-[11px] text-base-content/25">
                        #{entry.pr_number}
                      </span>
                      <span className="text-xs font-medium">{entry.action}</span>
                      {entry.details && (
                        <span className="text-xs text-base-content/35 truncate flex-1">
                          — {entry.details}
                        </span>
                      )}
                      {!entry.details && <span className="flex-1" />}
                      <span className="text-[10px] text-base-content/20 tabular-nums shrink-0">
                        {formatAge(entry.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ━━━ History ━━━ */}
            {resolved.length > 0 && <HistorySection items={resolved} onRemove={removeFromQueue} />}
          </div>
        ) : (
          /* ━━━━ OVERVIEW TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
          <div className="space-y-5 stagger">
            {/* Repo health cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {repos.map((r) => {
                const pct = r.healthPct;
                return (
                  <div
                    key={r.name}
                    className="animate-fade-in rounded-xl border border-base-200 p-4 card-hover"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-semibold text-sm">{r.name.split('/')[1]}</span>
                        <span className="text-xs text-base-content/30 ml-2">{r.total} PRs</span>
                      </div>
                      <div
                        className={`text-xl font-bold tabular-nums ${
                          pct >= 80 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-error'
                        }`}
                      >
                        {pct}
                        <span className="text-sm font-normal text-base-content/25">%</span>
                      </div>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden bg-base-200 gap-px">
                      {r.current > 0 && (
                        <div
                          className="bg-success rounded-full transition-all duration-700"
                          style={{ width: `${(r.current / r.total) * 100}%` }}
                        />
                      )}
                      {r.stale > 0 && (
                        <div
                          className="bg-warning rounded-full transition-all duration-700"
                          style={{ width: `${(r.stale / r.total) * 100}%` }}
                        />
                      )}
                      {r.dead > 0 && (
                        <div
                          className="bg-error rounded-full transition-all duration-700"
                          style={{ width: `${(r.dead / r.total) * 100}%` }}
                        />
                      )}
                    </div>
                    <div className="flex gap-4 mt-2.5 text-[11px] text-base-content/40">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                        {r.current} current
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                        {r.stale} stale
                      </span>
                      {r.dead > 0 && (
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-error" />
                          {r.dead} dead
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  {
                    label: 'Pipeline',
                    value: activePR ? 'Active' : 'Idle',
                    icon: <Activity size={14} />,
                    cls: activePR ? 'text-info' : 'text-base-content/30',
                  },
                  {
                    label: 'Queued',
                    value: String(queued.length),
                    icon: <Inbox size={14} />,
                    cls: queued.length > 0 ? 'text-warning' : 'text-base-content/30',
                  },
                  {
                    label: 'Resolved',
                    value: String(resolved.length),
                    icon: <CheckCircle size={14} />,
                    cls: 'text-success',
                  },
                  {
                    label: 'Stale',
                    value: String(staleCount),
                    icon: <AlertTriangle size={14} />,
                    cls: staleCount > 0 ? 'text-warning' : 'text-success',
                  },
                ] as const
              ).map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-base-200 p-3 text-center card-hover"
                >
                  <div className={`text-lg font-bold tabular-nums ${s.cls}`}>{s.value}</div>
                  <div className="flex items-center justify-center gap-1 text-[10px] text-base-content/35 mt-0.5">
                    <span className="opacity-50">{s.icon}</span>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* All PRs */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title">All Open PRs</h2>
              </div>
              <div className="flex gap-1 mb-3">
                {[
                  { key: 'all' as const, label: 'All', count: prs.length },
                  { key: 'current' as const, label: 'Current', count: currentCount },
                  { key: 'stale' as const, label: 'Stale', count: staleCount },
                  { key: 'dead' as const, label: 'Dead', count: deadCount },
                ].map((f) => (
                  <button
                    key={f.key}
                    className={`btn btn-xs gap-1 rounded-lg transition-all ${
                      filter === f.key ? 'btn-neutral' : 'btn-ghost text-base-content/50'
                    }`}
                    onClick={() => setFilter(filter === f.key && f.key !== 'all' ? 'all' : f.key)}
                  >
                    {f.label}
                    <span
                      className={`text-[10px] tabular-nums ${filter === f.key ? 'opacity-70' : 'opacity-40'}`}
                    >
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-base-200 overflow-hidden divide-y divide-base-200/80">
                {filtered.map((pr) => {
                  const s = staleness(pr, mainShas[pr.repo]);
                  const qItem = queue.find((q) => q.pr_number === pr.number && q.repo === pr.repo);
                  const agent = AGENT[pr.agentType];
                  const isDead = s === 'dead';
                  return (
                    <div
                      key={`${pr.repo}-${pr.number}`}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-base-200/30 transition-colors"
                    >
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            s === 'current' ? 'bg-success' : isDead ? 'bg-error' : 'bg-warning'
                          }`}
                        />
                        <span className="text-[10px] text-base-content/40 font-medium uppercase tracking-wide">
                          {s === 'current' ? 'current' : isDead ? 'dead' : 'stale'}
                        </span>
                      </div>
                      <span>{agent.emoji}</span>
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noopener"
                        title={pr.title}
                        className="flex-1 min-w-0 hover:underline truncate leading-tight"
                      >
                        <span className="font-mono text-[11px] text-base-content/25">
                          #{pr.number}
                        </span>{' '}
                        <span className="text-base-content/80">{pr.title}</span>
                      </a>
                      <span className="text-[10px] text-base-content/25 shrink-0 hidden sm:inline font-mono">
                        {pr.repo.split('/')[1]}
                      </span>
                      {qItem ? (
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            qItem.state === 'active'
                              ? 'bg-info/15 text-info'
                              : qItem.state === 'queued'
                                ? 'bg-warning/15 text-warning'
                                : qItem.state === 'resolved'
                                  ? 'bg-success/15 text-success'
                                  : 'bg-base-200 text-base-content/40'
                          }`}
                        >
                          {qItem.state === 'active' && <Circle size={6} className="fill-current" />}
                          {qItem.state}
                        </span>
                      ) : s !== 'current' ? (
                        <div className="flex gap-1 shrink-0">
                          <button
                            className="btn btn-xs btn-ghost text-primary rounded-lg"
                            onClick={() => queuePR(pr)}
                            disabled={actionLoading === `q-${pr.number}`}
                          >
                            Queue
                          </button>
                          {isDead && (
                            <button
                              className="btn btn-xs btn-ghost text-error rounded-lg"
                              onClick={() => agentAutoClose(pr)}
                              disabled={agentBusy}
                            >
                              Close
                            </button>
                          )}
                        </div>
                      ) : null}
                      <span className="text-[10px] text-base-content/20 w-9 text-right tabular-nums shrink-0">
                        {formatAge(pr.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* Footer */}
        <footer className="text-[10px] text-base-content/20 text-center py-6 mt-4 flex items-center justify-center gap-2">
          <span>Agent buttons trigger real GitHub actions</span>
          <span>·</span>
          <span>One session at a time</span>
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
      <div className="rounded-xl border border-dashed border-base-300 py-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center mx-auto mb-3">
          <Play size={22} className="text-base-content/20" />
        </div>
        <p className="font-semibold text-base-content/50">No active session</p>
        <p className="text-xs text-base-content/30 mt-1 max-w-[16rem] mx-auto leading-relaxed">
          Activate a PR from the queue below to start a Jules rebase conversation
        </p>
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
    </div>
  );
};

/* ━━━ History Section ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const HistorySection: React.FC<{
  items: QueueItem[];
  onRemove: (item: QueueItem) => void;
}> = ({ items, onRemove }) => {
  const [open, setOpen] = useState(false);
  return (
    <section className="animate-fade-in">
      <button
        className="flex items-center gap-2 group cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <h2 className="section-title">History</h2>
        <span className="text-xs font-mono text-base-content/25">{items.length}</span>
        <ChevronRight
          size={12}
          className={`text-base-content/25 transition-transform duration-200 ${
            open ? 'rotate-90' : ''
          }`}
        />
      </button>
      {open && (
        <div className="rounded-xl border border-base-200 overflow-hidden divide-y divide-base-200/80 mt-3">
          {items.map((q) => {
            const res = resolutionInfo(q.resolution);
            return (
              <div
                key={q.id}
                className="animate-fade-in flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-base-200/30 transition-colors"
              >
                <span>{q.state === 'skipped' ? '⏭️' : res.emoji}</span>
                <span className="font-mono text-[11px] text-base-content/25">#{q.pr_number}</span>
                <span className="text-base-content/35 text-xs">{q.repo.split('/')[1]}</span>
                <span className="flex-1 text-xs text-base-content/45">{res.label}</span>
                <span className="text-[10px] text-base-content/20 tabular-nums">
                  {q.resolved_at ? formatAge(q.resolved_at) + ' ago' : ''}
                </span>
                <button
                  className="btn btn-xs btn-ghost btn-square opacity-20 hover:opacity-100 hover:text-error"
                  onClick={() => onRemove(q)}
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
