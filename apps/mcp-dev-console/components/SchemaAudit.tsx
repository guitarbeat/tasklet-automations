import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  Info,
  Download,
  ArrowUpDown,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import { McpTool } from '../types';
import {
  auditAllTools,
  auditToMarkdown,
  gradeColor,
  gradeBg,
  AuditSummary,
  ToolAuditResult,
  Grade,
  Severity,
} from '../utils/audit';

interface Props {
  tools: McpTool[];
}

type SortKey = 'name' | 'score' | 'issues' | 'grade';
type SortDir = 'asc' | 'desc';

const SEVERITY_ICON: Record<Severity, React.ReactNode> = {
  error: <XCircle size={12} className="text-error shrink-0" />,
  warning: <AlertTriangle size={12} className="text-warning shrink-0" />,
  info: <Info size={12} className="text-info shrink-0" />,
};

const SEVERITY_BADGE: Record<Severity, string> = {
  error: 'badge-error',
  warning: 'badge-warning',
  info: 'badge-info',
};

const GRADE_RING: Record<Grade, string> = {
  A: 'ring-success',
  B: 'ring-info',
  C: 'ring-warning',
  D: 'ring-error',
  F: 'ring-error',
};

function GradeBadge({ grade, size = 'md' }: { grade: Grade; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-xl',
    xl: 'w-20 h-20 text-4xl',
  };
  return (
    <div
      className={`${sizeClasses[size]} rounded-full ring-2 ${GRADE_RING[grade]} ${gradeBg(grade)} flex items-center justify-center font-bold ${gradeColor(grade)}`}
    >
      {grade}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 90
      ? 'progress-success'
      : score >= 75
        ? 'progress-info'
        : score >= 60
          ? 'progress-warning'
          : 'progress-error';
  return (
    <div className="flex items-center gap-2 w-full">
      <progress className={`progress ${color} h-1.5 flex-1`} value={score} max={100} />
      <span className="text-[10px] font-mono text-base-content/50 w-6 text-right">{score}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-base-200 rounded-lg p-3 flex flex-col gap-0.5">
      <div className="text-[10px] uppercase tracking-wider text-base-content/40 font-bold">
        {label}
      </div>
      <div className={`text-xl font-bold ${accent || 'text-base-content'}`}>{value}</div>
      {sub && <div className="text-[10px] text-base-content/40">{sub}</div>}
    </div>
  );
}

interface ToolRowProps {
  result: ToolAuditResult;
  expanded: boolean;
  onToggle: () => void;
}

const ToolRow: React.FC<ToolRowProps> = ({ result, expanded, onToggle }) => {
  const errorCount = result.issues.filter((i) => i.severity === 'error').length;
  const warnCount = result.issues.filter((i) => i.severity === 'warning').length;
  const infoCount = result.issues.filter((i) => i.severity === 'info').length;

  return (
    <>
      <tr className="hover cursor-pointer transition-colors" onClick={onToggle}>
        <td className="w-6">
          {result.issues.length > 0 ? (
            expanded ? (
              <ChevronDown size={12} className="text-base-content/40" />
            ) : (
              <ChevronRight size={12} className="text-base-content/40" />
            )
          ) : (
            <CheckCircle size={12} className="text-success/40" />
          )}
        </td>
        <td className="font-mono text-xs">{result.toolName}</td>
        <td>
          <GradeBadge grade={result.grade} size="sm" />
        </td>
        <td>
          <ScoreBar score={result.score} />
        </td>
        <td className="text-xs">
          <div className="flex items-center gap-1">
            {errorCount > 0 && <span className="badge badge-xs badge-error">{errorCount}</span>}
            {warnCount > 0 && <span className="badge badge-xs badge-warning">{warnCount}</span>}
            {infoCount > 0 && <span className="badge badge-xs badge-info">{infoCount}</span>}
            {result.issues.length === 0 && (
              <span className="text-success/60 text-[10px]">Clean</span>
            )}
          </div>
        </td>
        <td className="text-[10px] text-base-content/40 font-mono">{result.checks.paramCount}p</td>
      </tr>
      {expanded && result.issues.length > 0 && (
        <tr>
          <td colSpan={6} className="bg-base-200/50 px-4 py-2">
            <div className="flex flex-col gap-1.5">
              {result.issues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {SEVERITY_ICON[issue.severity]}
                  <div className="flex-1 min-w-0">
                    <span className={`badge badge-xs ${SEVERITY_BADGE[issue.severity]} mr-1.5`}>
                      {issue.code}
                    </span>
                    <span className="text-base-content/70">{issue.message}</span>
                    {issue.suggestion && (
                      <div className="text-[10px] text-primary/70 mt-0.5 flex items-start gap-1">
                        <span className="shrink-0">💡</span>
                        <span>{issue.suggestion}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export const SchemaAudit: React.FC<Props> = ({ tools }) => {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterGrade, setFilterGrade] = useState<Grade | 'all'>('all');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const audit = useMemo(() => auditAllTools(tools), [tools]);

  const toggleTool = useCallback((name: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const sortedResults = useMemo(() => {
    let filtered = audit.results;

    // Filter by grade
    if (filterGrade !== 'all') {
      filtered = filtered.filter((r) => r.grade === filterGrade);
    }

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.toolName.toLowerCase().includes(q) ||
          r.issues.some(
            (i) => i.message.toLowerCase().includes(q) || i.code.toLowerCase().includes(q),
          ),
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.toolName.localeCompare(b.toolName);
          break;
        case 'score':
          cmp = a.score - b.score;
          break;
        case 'issues':
          cmp = a.issues.length - b.issues.length;
          break;
        case 'grade':
          cmp = a.score - b.score;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [audit.results, sortKey, sortDir, filterGrade, search]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'asc');
    }
  };

  const handleExport = useCallback(async () => {
    const md = auditToMarkdown(audit);
    try {
      await window.tasklet.writeFileToDisk('/agent/home/schema-audit-report.md', md);
      await window.tasklet.sendMessageToAgent(
        'Schema audit report saved to /agent/home/schema-audit-report.md',
      );
    } catch {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(md);
    }
  }, [audit]);

  const handleCopy = useCallback(async () => {
    const md = auditToMarkdown(audit);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [audit]);

  const expandAll = () => setExpandedTools(new Set(sortedResults.map((r) => r.toolName)));
  const collapseAll = () => setExpandedTools(new Set());

  if (tools.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-base-content/20 gap-3">
        <AlertTriangle size={48} strokeWidth={1} />
        <div className="text-center">
          <div className="text-sm font-medium">No tools loaded</div>
          <div className="text-xs mt-1 text-base-content/15">
            Connect to an MCP server to run the audit
          </div>
        </div>
      </div>
    );
  }

  const totalIssues = audit.results.reduce((sum, r) => sum + r.issues.length, 0);
  const errorCount = audit.results.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === 'error').length,
    0,
  );
  const cleanTools = audit.results.filter((r) => r.issues.length === 0).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary header */}
      <div className="shrink-0 p-4 border-b border-base-300">
        <div className="flex items-center gap-4">
          <GradeBadge grade={audit.overallGrade} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold">Schema Audit Report</div>
            <div className="text-xs text-base-content/50 mt-0.5">
              {audit.totalTools} tools analyzed · {totalIssues} issues found · {cleanTools} clean
            </div>
            <div className="flex gap-4 mt-2">
              {(['A', 'B', 'C', 'D', 'F'] as Grade[]).map(
                (g) =>
                  audit.gradeDistribution[g] > 0 && (
                    <button
                      key={g}
                      className={`flex items-center gap-1 text-xs cursor-pointer transition-opacity ${filterGrade === g ? 'opacity-100' : 'opacity-50 hover:opacity-75'}`}
                      onClick={() => setFilterGrade(filterGrade === g ? 'all' : g)}
                    >
                      <GradeBadge grade={g} size="sm" />
                      <span className="font-mono">{audit.gradeDistribution[g]}</span>
                    </button>
                  ),
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <button
              className="btn btn-xs btn-ghost gap-1"
              onClick={handleExport}
              title="Save report"
            >
              <Download size={12} />
              <span className="text-[10px]">Export</span>
            </button>
            <button
              className="btn btn-xs btn-ghost gap-1"
              onClick={handleCopy}
              title="Copy as Markdown"
            >
              {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
              <span className="text-[10px]">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <StatCard
            label="Score"
            value={`${audit.overallScore}/100`}
            accent={gradeColor(audit.overallGrade)}
          />
          <StatCard
            label="Errors"
            value={errorCount}
            accent={errorCount > 0 ? 'text-error' : 'text-success'}
            sub={errorCount === 0 ? 'None!' : 'Need fixing'}
          />
          <StatCard
            label="Clean Tools"
            value={cleanTools}
            accent="text-success"
            sub={`${Math.round((cleanTools / audit.totalTools) * 100)}% pass`}
          />
          <StatCard
            label="Avg Params"
            value={(
              audit.results.reduce((s, r) => s + r.checks.paramCount, 0) / audit.totalTools
            ).toFixed(1)}
            sub="per tool"
          />
        </div>
      </div>

      {/* Top issues */}
      {audit.topIssues.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-b border-base-300">
          <div className="text-[10px] uppercase tracking-wider text-base-content/40 font-bold mb-1.5">
            Top Issues Across All Tools
          </div>
          <div className="flex flex-wrap gap-1.5">
            {audit.topIssues.map((issue) => (
              <button
                key={issue.code}
                className="badge badge-sm gap-1 cursor-pointer hover:opacity-80"
                onClick={() => setSearch(issue.code)}
                title={`Filter by ${issue.code}`}
              >
                <span className="font-mono text-[10px]">{issue.code}</span>
                <span className="badge badge-xs">{issue.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="shrink-0 px-4 py-1.5 border-b border-base-300 flex items-center gap-2">
        <label className="input input-bordered input-xs flex items-center gap-2 flex-1 max-w-xs">
          <Search size={11} className="opacity-50" />
          <input
            type="search"
            className="grow"
            placeholder="Filter tools or issues…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="flex items-center gap-1 text-[10px] text-base-content/40">
          <Filter size={10} />
          {filterGrade !== 'all' && (
            <button
              className="badge badge-xs badge-primary gap-0.5"
              onClick={() => setFilterGrade('all')}
            >
              Grade {filterGrade} ✕
            </button>
          )}
          {search && (
            <button className="badge badge-xs badge-primary gap-0.5" onClick={() => setSearch('')}>
              "{search}" ✕
            </button>
          )}
        </div>
        <div className="ml-auto flex gap-1">
          <button className="btn btn-ghost btn-xs text-[10px]" onClick={expandAll}>
            Expand all
          </button>
          <button className="btn btn-ghost btn-xs text-[10px]" onClick={collapseAll}>
            Collapse all
          </button>
        </div>
        <span className="text-[10px] text-base-content/30 font-mono">
          {sortedResults.length} shown
        </span>
      </div>

      {/* Results table */}
      <div className="flex-1 min-h-0 overflow-auto thin-scroll">
        <table className="table table-xs w-full">
          <thead className="sticky top-0 bg-base-100 z-10">
            <tr className="text-[10px] uppercase text-base-content/40">
              <th className="w-6"></th>
              <th className="cursor-pointer select-none" onClick={() => handleSort('name')}>
                <span className="flex items-center gap-0.5">
                  Tool <ArrowUpDown size={9} />
                </span>
              </th>
              <th className="cursor-pointer select-none w-12" onClick={() => handleSort('grade')}>
                <span className="flex items-center gap-0.5">
                  Grade <ArrowUpDown size={9} />
                </span>
              </th>
              <th className="cursor-pointer select-none w-32" onClick={() => handleSort('score')}>
                <span className="flex items-center gap-0.5">
                  Score <ArrowUpDown size={9} />
                </span>
              </th>
              <th className="cursor-pointer select-none w-24" onClick={() => handleSort('issues')}>
                <span className="flex items-center gap-0.5">
                  Issues <ArrowUpDown size={9} />
                </span>
              </th>
              <th className="w-10">Params</th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((result) => (
              <ToolRow
                key={result.toolName}
                result={result}
                expanded={expandedTools.has(result.toolName)}
                onToggle={() => toggleTool(result.toolName)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
