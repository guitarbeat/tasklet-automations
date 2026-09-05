import React, { useMemo, useState } from 'react';
import { LayoutGrid, ExternalLink, Inbox } from 'lucide-react';
import { PullRequest, Staleness } from '../types';
import { staleness, daysSince, formatSize } from '../utils/helpers';

/* ─── Squarified treemap layout ─────────────────────────────── */

interface Rect { x: number; y: number; w: number; h: number }
export interface Tile<T> extends Rect { item: T; value: number }

function worst(row: number[], length: number, scale: number): number {
  const sum = row.reduce((a, b) => a + b, 0) * scale;
  const max = Math.max(...row) * scale;
  const min = Math.min(...row) * scale;
  const s2 = sum * sum;
  const l2 = length * length;
  return Math.max((l2 * max) / s2, s2 / (l2 * min));
}

/** Squarified treemap (Bruls, Huizing & van Wijk). Values must be > 0. */
function squarify<T>(items: { item: T; value: number }[], rect: Rect): Tile<T>[] {
  const sorted = [...items].sort((a, b) => b.value - a.value).filter(d => d.value > 0);
  if (!sorted.length) return [];

  const total = sorted.reduce((a, d) => a + d.value, 0);
  const area = rect.w * rect.h;
  if (area <= 0 || total <= 0) return [];
  const scale = area / total;

  const out: Tile<T>[] = [];
  let free: Rect = { ...rect };
  let queue = [...sorted];

  while (queue.length) {
    const side = Math.min(free.w, free.h);
    const row: typeof queue = [];
    const rowVals: number[] = [];

    while (queue.length) {
      const next = queue[0];
      const candidate = [...rowVals, next.value];
      if (row.length && worst(rowVals, side, scale) <= worst(candidate, side, scale)) break;
      row.push(next);
      rowVals.push(next.value);
      queue.shift();
    }

    const rowArea = rowVals.reduce((a, b) => a + b, 0) * scale;
    const horizontal = free.w >= free.h;
    const thickness = side > 0 ? rowArea / side : 0;

    let offset = horizontal ? free.y : free.x;
    for (let i = 0; i < row.length; i++) {
      const cellArea = rowVals[i] * scale;
      const extent = thickness > 0 ? cellArea / thickness : 0;
      out.push({
        item: row[i].item,
        value: row[i].value,
        x: horizontal ? free.x : offset,
        y: horizontal ? offset : free.y,
        w: horizontal ? thickness : extent,
        h: horizontal ? extent : thickness,
      });
      offset += extent;
    }

    if (horizontal) {
      free = { x: free.x + thickness, y: free.y, w: Math.max(0, free.w - thickness), h: free.h };
    } else {
      free = { x: free.x, y: free.y + thickness, w: free.w, h: Math.max(0, free.h - thickness) };
    }
    if (free.w < 0.01 || free.h < 0.01) break;
  }

  return out;
}

/* ─── Metrics ───────────────────────────────────────────────── */

type Metric = 'churn' | 'files' | 'age';

const METRICS: { key: Metric; label: string; hint: string }[] = [
  { key: 'churn', label: 'Churn', hint: 'lines added + deleted' },
  { key: 'files', label: 'Files', hint: 'files changed' },
  { key: 'age',   label: 'Age',   hint: 'days since opened' },
];

function metricValue(pr: PullRequest, metric: Metric): number {
  if (metric === 'age') return Math.max(1, daysSince(pr.createdAt));
  const d = pr.detail;
  if (!d) return 1;
  if (metric === 'files') return Math.max(1, d.changedFiles);
  return Math.max(1, d.additions + d.deletions);
}

function metricLabel(pr: PullRequest, metric: Metric): string {
  if (metric === 'age') return `${daysSince(pr.createdAt)}d`;
  const d = pr.detail;
  if (!d) return '—';
  if (metric === 'files') return `${d.changedFiles}f`;
  return formatSize(d.additions, d.deletions);
}

const STALE_STYLE: Record<Staleness, { fill: string; border: string; dot: string; label: string }> = {
  current: { fill: 'rgba(34,197,94,0.16)',  border: 'rgba(34,197,94,0.45)',  dot: 'bg-success', label: 'Up to date' },
  stale:   { fill: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.48)', dot: 'bg-warning', label: 'Stale' },
  dead:    { fill: 'rgba(239,68,68,0.18)',  border: 'rgba(239,68,68,0.50)',  dot: 'bg-error',   label: 'Dead' },
};

/* ─── Component ─────────────────────────────────────────────── */

interface Props {
  prs: PullRequest[];
  mainShas: Record<string, string>;
  queuedKeys: Set<string>;
  onQueue: (pr: PullRequest) => void;
}

const W = 1000;
const H = 340;
const GROUP_HEADER = 18;
const GAP = 4;

export function PRTreemap({ prs, mainShas, queuedKeys, onQueue }: Props) {
  const [metric, setMetric] = useState<Metric>('churn');
  const [hover, setHover] = useState<{ pr: PullRequest; x: number; y: number } | null>(null);

  const groups = useMemo(() => {
    const byRepo = new Map<string, PullRequest[]>();
    for (const pr of prs) {
      if (!byRepo.has(pr.repo)) byRepo.set(pr.repo, []);
      byRepo.get(pr.repo)!.push(pr);
    }
    return [...byRepo.entries()]
      .map(([repo, list]) => ({
        repo,
        list,
        value: list.reduce((a, p) => a + metricValue(p, metric), 0),
      }))
      .sort((a, b) => b.value - a.value);
  }, [prs, metric]);

  const layout = useMemo(() => {
    if (!groups.length) return [];
    type Group = typeof groups[number];
    const outer = squarify<Group>(
      groups.map(g => ({ item: g, value: g.value })),
      { x: 0, y: 0, w: W, h: H },
    );
    return outer.map(cell => {
      const inner: Rect = {
        x: cell.x + GAP / 2,
        y: cell.y + GAP / 2 + GROUP_HEADER,
        w: Math.max(0, cell.w - GAP),
        h: Math.max(0, cell.h - GAP - GROUP_HEADER),
      };
      return {
        group: cell.item,
        rect: cell,
        tiles: squarify<PullRequest>(
          cell.item.list.map(pr => ({ item: pr, value: metricValue(pr, metric) })),
          inner,
        ),
      };
    });
  }, [groups, metric]);

  const totals = useMemo(() => {
    const counts: Record<Staleness, number> = { current: 0, stale: 0, dead: 0 };
    for (const pr of prs) counts[staleness(pr, mainShas[pr.repo])]++;
    return counts;
  }, [prs, mainShas]);

  const activeMetric = METRICS.find(m => m.key === metric)!;
  const missingDetail = metric !== 'age' && prs.some(p => !p.detail);

  if (!prs.length) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="section-title text-xs flex items-center gap-1.5">
            <LayoutGrid size={12} className="text-base-content/30" />
            PR Map
          </h2>
          <span className="text-[9px] text-base-content/20 tabular-nums">
            {prs.length} PRs · {groups.length} repos · sized by {activeMetric.hint}
          </span>
        </div>
        <div className="flex gap-1">
          {METRICS.map(m => (
            <button
              key={m.key}
              title={`Size tiles by ${m.hint}`}
              className={`btn btn-xs rounded-lg h-6 min-h-0 text-[10px] ${
                metric === m.key ? 'btn-neutral' : 'btn-ghost text-base-content/40'
              }`}
              onClick={() => setMetric(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-lg border border-base-200 bg-base-100 p-2 overflow-hidden">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 'clamp(220px, 34vh, 380px)' }}
          onMouseLeave={() => setHover(null)}
        >
          {layout.map(({ group, rect, tiles }) => (
            <g key={group.repo}>
              <text
                x={rect.x + 6}
                y={rect.y + 13}
                className="fill-base-content/40"
                style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }}
              >
                {rect.w > 150 ? group.repo : group.repo.split('/')[1] ?? group.repo}
              </text>
              <text
                x={rect.x + rect.w - 6}
                y={rect.y + 13}
                textAnchor="end"
                className="fill-base-content/20"
                style={{ fontSize: 10 }}
              >
                {group.list.length}
              </text>

              {tiles.map(({ item: pr, x, y, w, h }) => {
                const s = staleness(pr, mainShas[pr.repo]);
                const style = STALE_STYLE[s];
                const queued = queuedKeys.has(`${pr.repo}#${pr.number}`);
                const showNum = w > 34 && h > 20;
                const showTitle = w > 96 && h > 42;
                return (
                  <g
                    key={`${pr.repo}#${pr.number}`}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover({ pr, x: x + w / 2, y })}
                    onClick={() => window.open(pr.url, '_blank', 'noopener')}
                  >
                    <title>{`#${pr.number} ${pr.title}`}</title>
                    <rect
                      x={x}
                      y={y}
                      width={Math.max(0, w - 2)}
                      height={Math.max(0, h - 2)}
                      rx={4}
                      fill={style.fill}
                      stroke={hover?.pr === pr ? 'currentColor' : style.border}
                      strokeWidth={hover?.pr === pr ? 1.6 : 1}
                      className={hover?.pr === pr ? 'text-base-content/50' : ''}
                    />
                    {queued && (
                      <circle cx={x + w - 9} cy={y + 9} r={2.6} className="fill-info" />
                    )}
                    {showNum && (
                      <text
                        x={x + 7}
                        y={y + 16}
                        className="fill-base-content/70"
                        style={{ fontSize: 11, fontWeight: 700 }}
                      >
                        #{pr.number}
                      </text>
                    )}
                    {showNum && w > 66 && (
                      <text
                        x={x + 7}
                        y={y + Math.max(0, h - 9)}
                        className="fill-base-content/30"
                        style={{ fontSize: 9 }}
                      >
                        {metricLabel(pr, metric)} · {pr.author.slice(0, 14)}
                      </text>
                    )}
                    {showTitle && (
                      <text
                        x={x + 7}
                        y={y + 30}
                        className="fill-base-content/45"
                        style={{ fontSize: 10 }}
                      >
                        {pr.title.length > Math.floor(w / 6)
                          ? pr.title.slice(0, Math.max(3, Math.floor(w / 6) - 1)) + '…'
                          : pr.title}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>

        {/* Hover card */}
        {hover && (
          <div
            className="absolute z-20 pointer-events-auto rounded-lg border border-base-300 bg-base-100 shadow-lg p-2.5 w-64"
            style={{
              left: `calc(${(hover.x / W) * 100}% )`,
              top: `calc(${(hover.y / H) * 100}% + 2.6rem)`,
              transform: 'translateX(-50%)',
            }}
            onMouseLeave={() => setHover(null)}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${STALE_STYLE[staleness(hover.pr, mainShas[hover.pr.repo])].dot}`} />
              <span className="font-mono text-[10px] text-base-content/40">#{hover.pr.number}</span>
              <span className="text-[9px] text-base-content/25 truncate">{hover.pr.repo}</span>
            </div>
            <div className="text-[11px] font-medium leading-snug mb-1.5 line-clamp-2">{hover.pr.title}</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-base-content/40 mb-2">
              <span>{hover.pr.author}</span>
              <span>{daysSince(hover.pr.createdAt)}d old</span>
              {hover.pr.detail && <span>+{hover.pr.detail.additions} / −{hover.pr.detail.deletions}</span>}
              {hover.pr.detail && <span>{hover.pr.detail.changedFiles} files</span>}
            </div>
            <div className="flex gap-1">
              <button
                className="btn btn-xs rounded-lg h-6 min-h-0 text-[10px] flex-1 gap-1"
                disabled={queuedKeys.has(`${hover.pr.repo}#${hover.pr.number}`)}
                onClick={e => { e.stopPropagation(); onQueue(hover.pr); }}
              >
                <Inbox size={10} />
                {queuedKeys.has(`${hover.pr.repo}#${hover.pr.number}`) ? 'Queued' : 'Queue'}
              </button>
              <a
                className="btn btn-xs btn-ghost rounded-lg h-6 min-h-0 text-[10px] gap-1"
                href={hover.pr.url}
                target="_blank"
                rel="noopener"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink size={10} />
                Open
              </a>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 mt-1.5 px-1 text-[9px] text-base-content/25">
          {(['current', 'stale', 'dead'] as Staleness[]).map(s => (
            <span key={s} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${STALE_STYLE[s].dot}`} />
              {STALE_STYLE[s].label} <span className="tabular-nums opacity-60">{totals[s]}</span>
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-info" /> queued
          </span>
          <span className="ml-auto">
            {missingDetail ? 'some PRs lack size detail — shown at minimum area' : 'tile area = ' + activeMetric.hint}
          </span>
        </div>
      </div>
    </section>
  );
}
