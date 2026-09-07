import React, { useEffect, useState, useCallback } from 'react';
import {
  ClipboardList,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  GitPullRequest,
  Clock,
  AlertOctagon,
  Archive,
  Hash,
} from 'lucide-react';
import type {
  JulesAuditData,
  JulesAuditStaleOutput,
  JulesAuditMisconfiguredPR,
  JulesAuditLingering,
} from '../types';
import { formatAge } from '../utils/helpers';

const AUDIT_FILE = '/tasklet/agent/home/apps/pr-health/jules-audit.json';
const AUDIT_CMD = 'cd /tasklet/agent/home/scripts && bun -i jules_audit.ts';

const api = window.tasklet;

type FindingKey = 'stale_outputs' | 'misconfigured_active_prs' | 'lingering_closed_or_merged';

function shortId(id: string): string {
  return id.length > 6 ? `…${id.slice(-6)}` : id;
}

function truncate(s: string, n: number): string {
  const oneLine = s.split('\n')[0];
  return oneLine.length > n ? `${oneLine.slice(0, n - 1)}…` : oneLine;
}

function shortSha(sha: string | undefined): string {
  if (!sha) return '—';
  return sha.slice(0, 7);
}

const STATE_COLOR: Record<string, string> = {
  COMPLETED: 'bg-success/10 text-success',
  FAILED: 'bg-error/10 text-error',
  IN_PROGRESS: 'bg-info/10 text-info',
  QUEUED: 'bg-base-200 text-base-content/40',
  PAUSED: 'bg-warning/10 text-warning',
  AWAITING_USER_FEEDBACK: 'bg-warning/10 text-warning',
};

function stateBadgeClass(state: string): string {
  return STATE_COLOR[state] || 'bg-base-200 text-base-content/40';
}

interface FindingCardMeta {
  key: FindingKey;
  label: string;
  desc: string;
  severity: 'warning' | 'error';
  icon: React.ReactNode;
}

const FINDING_META: FindingCardMeta[] = [
  {
    key: 'stale_outputs',
    label: 'Stale Outputs',
    desc: 'Sessions whose diff no longer matches the branch head',
    severity: 'warning',
    icon: <GitBranch size={12} />,
  },
  {
    key: 'misconfigured_active_prs',
    label: 'Misconfigured Active PRs',
    desc: 'Active sessions pointed at the wrong PR branch',
    severity: 'error',
    icon: <AlertOctagon size={12} />,
  },
  {
    key: 'lingering_closed_or_merged',
    label: 'Lingering Closed/Merged',
    desc: 'Sessions left open after their PR was closed or merged',
    severity: 'warning',
    icon: <Archive size={12} />,
  },
];

export const JulesAuditPanel: React.FC = () => {
  const [data, setData] = useState<JulesAuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const loadAudit = useCallback(async () => {
    try {
      const raw = await api.readFileFromDisk(AUDIT_FILE);
      const parsed = JSON.parse(raw) as JulesAuditData;
      setData(parsed);
    } catch {
      /* no audit file yet, or it failed to parse — show empty state */
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const runAudit = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await api.runCommand(AUDIT_CMD, 120);
      if (res.exitCode !== 0) {
        console.error('jules_audit.ts failed:', res.log);
        setError(`Audit script exited with code ${res.exitCode}. ${truncate(res.log, 200)}`);
      } else {
        await loadAudit();
      }
    } catch (e: any) {
      console.error('Failed to run Jules audit:', e);
      setError(e?.message || 'Failed to run the audit.');
    } finally {
      setRunning(false);
    }
  };

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const stateEntries: [string, number][] = data
    ? Object.keys(data.by_state)
        .map((state): [string, number] => [state, data.by_state[state]])
        .filter(([, count]) => count > 0)
    : [];

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <h2 className="section-title text-xs">Jules Audit</h2>
          {data && (
            <span className="text-[9px] font-mono text-base-content/25 bg-base-200/60 px-1.5 py-0.5 rounded">
              {data.total_sessions} sessions
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data?.generated_at && (
            <span
              className="text-[9px] text-base-content/25 flex items-center gap-1 tabular-nums"
              title={new Date(data.generated_at).toLocaleString()}
            >
              <Clock size={8} />
              {formatAge(data.generated_at)} ago
            </span>
          )}
          <button
            className="btn btn-xs gap-1 btn-outline btn-primary rounded-lg h-6 min-h-0 text-[10px]"
            onClick={runAudit}
            disabled={running}
          >
            {running ? <Loader2 size={10} className="animate-spin" /> : <ClipboardList size={10} />}
            {running ? 'Running…' : 'Run Jules Audit'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error py-2 px-3 text-xs mb-2">
          <AlertTriangle size={13} />
          <span className="leading-snug">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-base-300 py-6 text-center text-xs text-base-content/30">
          <Loader2 size={14} className="animate-spin inline-block mr-1.5" /> Loading audit…
        </div>
      ) : !data ? (
        <div className="rounded-lg border border-dashed border-base-300 py-6 text-center">
          <p className="text-xs text-base-content/40 mb-1">No audit data yet</p>
          <p className="text-[10px] text-base-content/25">
            Run the audit to scan Jules sessions for cleanup issues.
          </p>
        </div>
      ) : (
        <div className="space-y-2 animate-fade-in">
          {/* by_state chips */}
          {stateEntries.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {stateEntries.map(([state, count]) => (
                <span key={state} className={`micro-badge ${stateBadgeClass(state)}`}>
                  {state.split('_').join(' ').toLowerCase()}
                  <span className="font-extrabold tabular-nums">{count}</span>
                </span>
              ))}
            </div>
          )}

          {/* Finding cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {FINDING_META.map((meta) => {
              const count = data.counts[meta.key] || 0;
              const items = data.findings[meta.key] || [];
              const healthy = count === 0;
              const isOpen = !!expanded[meta.key];
              const ringColor = healthy
                ? 'ring-success/15'
                : meta.severity === 'error'
                  ? 'ring-error/20'
                  : 'ring-warning/20';
              const bgColor = healthy
                ? ''
                : meta.severity === 'error'
                  ? 'bg-error/5'
                  : 'bg-warning/5';
              const textColor = healthy
                ? 'text-success'
                : meta.severity === 'error'
                  ? 'text-error'
                  : 'text-warning';
              return (
                <div
                  key={meta.key}
                  className={`rounded-lg border border-base-200 p-2.5 ring-1 ${ringColor} ${bgColor} card-hover`}
                >
                  <button
                    className="w-full flex items-center justify-between gap-1.5 text-left"
                    onClick={() => count > 0 && toggle(meta.key)}
                    disabled={count === 0}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={textColor}>
                        {healthy ? <CheckCircle2 size={12} /> : meta.icon}
                      </span>
                      <span className="text-[11px] font-semibold truncate">{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-sm font-black tabular-nums ${textColor}`}>
                        {count}
                      </span>
                      {count > 0 &&
                        (isOpen ? (
                          <ChevronDown size={12} className="opacity-40" />
                        ) : (
                          <ChevronRight size={12} className="opacity-40" />
                        ))}
                    </div>
                  </button>
                  <p className="text-[9px] text-base-content/30 mt-1 leading-tight">{meta.desc}</p>

                  {isOpen && count > 0 && (
                    <div className="mt-2 -mx-1 max-h-56 overflow-y-auto custom-scrollbar space-y-1 animate-slide-up">
                      {items.map((item, i) => (
                        <div
                          key={`${item.id}-${i}`}
                          className="pr-row bg-base-100/60 rounded-md px-1.5 py-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`micro-badge ${stateBadgeClass(item.state)}`}>
                              {item.state.toLowerCase()}
                            </span>
                            <span className="text-[9px] font-mono text-base-content/25 truncate">
                              {item.repo.split('/')[1]}
                            </span>
                            <span className="text-[8px] font-mono text-base-content/15 ml-auto shrink-0">
                              {shortId(item.id)}
                            </span>
                          </div>
                          <p
                            className="text-[10px] text-base-content/60 leading-snug mt-0.5"
                            title={item.title}
                          >
                            {truncate(item.title, 90)}
                          </p>
                          {meta.key === 'stale_outputs' && (
                            <div className="flex items-center gap-1 mt-1 text-[9px] text-base-content/25 font-mono">
                              <GitBranch size={9} className="opacity-50" />
                              base {shortSha((item as JulesAuditStaleOutput).base)} → head{' '}
                              {shortSha((item as JulesAuditStaleOutput).head)}
                            </div>
                          )}
                          {meta.key === 'misconfigured_active_prs' && (
                            <div className="flex items-center gap-1 mt-1 text-[9px] text-base-content/25 font-mono">
                              <GitPullRequest size={9} className="opacity-50" />
                              PR #{(item as JulesAuditMisconfiguredPR).pr} · session{' '}
                              {(item as JulesAuditMisconfiguredPR).sessionBranch} ≠ pr{' '}
                              {(item as JulesAuditMisconfiguredPR).prBranch}
                            </div>
                          )}
                          {meta.key === 'lingering_closed_or_merged' && (
                            <div className="flex items-center gap-1 mt-1 text-[9px] text-base-content/25 font-mono">
                              <Hash size={9} className="opacity-50" />
                              PR #{(item as JulesAuditLingering).pr} ·{' '}
                              {(item as JulesAuditLingering).merged ? 'merged' : 'closed'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {data.errors && data.errors.length > 0 && (
            <div className="alert alert-warning py-1.5 px-2.5 text-[10px]">
              <AlertTriangle size={11} />
              <span>
                {data.errors.length} error{data.errors.length > 1 ? 's' : ''} occurred during the
                last audit run.
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
