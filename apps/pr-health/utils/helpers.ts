import {
  PullRequest,
  AgentType,
  RepoHealth,
  Staleness,
  HealthScore,
  HealthGrade,
  HealthFactor,
  PRDetail,
} from '../types';

export function daysSince(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

export function formatAge(dateStr: string): string {
  const d = daysSince(dateStr);
  if (d === 0) return 'today';
  if (d === 1) return '1d';
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.floor(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

export function detectAgent(title: string): AgentType {
  const t = title.toLowerCase();
  if (t.includes('sentinel') || title.includes('🛡️')) return 'sentinel';
  if (t.includes('bolt') || title.includes('⚡')) return 'bolt';
  if (t.includes('palette') || title.includes('🎨')) return 'palette';
  return 'other';
}

export const AGENT: Record<AgentType, { emoji: string; label: string }> = {
  sentinel: { emoji: '🛡️', label: 'Security' },
  bolt: { emoji: '⚡', label: 'Performance' },
  palette: { emoji: '🎨', label: 'Style' },
  other: { emoji: '📦', label: 'Other' },
};

export function staleness(pr: PullRequest, mainSha: string | undefined): Staleness {
  if (!mainSha) return 'stale';
  if (pr.baseSha === mainSha) return 'current';
  if (daysSince(pr.updatedAt) > 90) return 'dead';
  return 'stale';
}

export function repoHealth(prs: PullRequest[], repo: string, mainSha: string): RepoHealth {
  const rp = prs.filter((p) => p.repo === repo);
  const current = rp.filter((p) => p.baseSha === mainSha).length;
  const dead = rp.filter((p) => p.baseSha !== mainSha && daysSince(p.updatedAt) > 90).length;
  const staleCount = rp.length - current - dead;
  return {
    name: repo,
    total: rp.length,
    current,
    stale: staleCount,
    dead,
    healthPct: rp.length > 0 ? Math.round((current / rp.length) * 100) : 100,
  };
}

export const PRIORITY: Record<string, number> = { sentinel: 3, bolt: 2, palette: 1, other: 0 };

export const RESOLUTIONS = [
  { key: 'merged', label: 'Merged', emoji: '🎉' },
  { key: 'rebased', label: 'Rebased', emoji: '🔄' },
  { key: 'closed', label: 'Closed', emoji: '🚪' },
  { key: 'manually-resolved', label: 'Manual fix', emoji: '👤' },
  { key: 'jules-failed', label: 'Jules failed', emoji: '💔' },
  { key: 'dead-90d', label: 'Dead (90d)', emoji: '💀' },
] as const;

export function resolutionInfo(key: string | null): { label: string; emoji: string } {
  const found = RESOLUTIONS.find((r) => r.key === key);
  return found || { label: key || 'Unknown', emoji: '❓' };
}

/* ─── Health Score System ────────────────────────────────────── */

const GRADE_THRESHOLDS: [number, HealthGrade][] = [
  [85, 'A'],
  [70, 'B'],
  [55, 'C'],
  [40, 'D'],
  [0, 'F'],
];

export const GRADE_COLORS: Record<
  HealthGrade,
  { bg: string; text: string; ring: string; fill: string }
> = {
  A: { bg: 'bg-success/10', text: 'text-success', ring: 'ring-success/30', fill: 'bg-success' },
  B: { bg: 'bg-info/10', text: 'text-info', ring: 'ring-info/30', fill: 'bg-info' },
  C: { bg: 'bg-warning/10', text: 'text-warning', ring: 'ring-warning/30', fill: 'bg-warning' },
  D: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    ring: 'ring-orange-400/30',
    fill: 'bg-orange-400',
  },
  F: { bg: 'bg-error/10', text: 'text-error', ring: 'ring-error/30', fill: 'bg-error' },
};

export function computeHealthScore(pr: PullRequest, mainSha: string | undefined): HealthScore {
  const factors: HealthFactor[] = [];
  let score = 100;

  // 1. Age factor (up to -30 pts)
  const age = daysSince(pr.createdAt);
  if (age <= 7) {
    factors.push({ label: 'Fresh', impact: 'positive', detail: `Opened ${age}d ago` });
  } else if (age <= 30) {
    score -= 10;
    factors.push({ label: 'Aging', impact: 'neutral', detail: `${age} days old` });
  } else if (age <= 90) {
    score -= 20;
    factors.push({ label: 'Old', impact: 'negative', detail: `${age} days old` });
  } else {
    score -= 30;
    factors.push({ label: 'Ancient', impact: 'negative', detail: `${age} days since opened` });
  }

  // 2. Staleness factor (up to -25 pts)
  const s = staleness(pr, mainSha);
  if (s === 'current') {
    factors.push({ label: 'Up to date', impact: 'positive', detail: 'Base branch is current' });
  } else if (s === 'stale') {
    score -= 15;
    factors.push({ label: 'Stale base', impact: 'negative', detail: 'Needs rebase' });
  } else {
    score -= 25;
    factors.push({
      label: 'Dead',
      impact: 'negative',
      detail: 'Stale > 90 days, needs intervention',
    });
  }

  // 3. Review status factor (up to -20 pts)
  if (pr.detail) {
    const rs = pr.detail.reviewStatus;
    if (rs === 'APPROVED') {
      score += 5; // bonus
      factors.push({
        label: 'Approved',
        impact: 'positive',
        detail: `By ${pr.detail.approvedBy.join(', ') || 'reviewer'}`,
      });
    } else if (rs === 'CHANGES_REQUESTED') {
      score -= 20;
      factors.push({
        label: 'Changes requested',
        impact: 'negative',
        detail: `By ${pr.detail.changesRequestedBy.join(', ') || 'reviewer'}`,
      });
    } else if (rs === 'PENDING') {
      score -= 5;
      factors.push({ label: 'Review pending', impact: 'neutral', detail: 'Awaiting reviewer' });
    } else {
      score -= 10;
      factors.push({ label: 'No reviews', impact: 'neutral', detail: 'No reviews yet' });
    }

    // 4. Size factor (up to -15 pts)
    const totalChanges = pr.detail.additions + pr.detail.deletions;
    if (totalChanges <= 50) {
      factors.push({
        label: 'Small PR',
        impact: 'positive',
        detail: `${totalChanges} lines changed`,
      });
    } else if (totalChanges <= 200) {
      score -= 5;
      factors.push({
        label: 'Medium PR',
        impact: 'neutral',
        detail: `${totalChanges} lines changed`,
      });
    } else if (totalChanges <= 500) {
      score -= 10;
      factors.push({
        label: 'Large PR',
        impact: 'negative',
        detail: `${totalChanges} lines across ${pr.detail.changedFiles} files`,
      });
    } else {
      score -= 15;
      factors.push({
        label: 'Huge PR',
        impact: 'negative',
        detail: `${totalChanges} lines across ${pr.detail.changedFiles} files`,
      });
    }

    // 5. Draft factor
    if (pr.detail.draft) {
      score -= 10;
      factors.push({ label: 'Draft', impact: 'neutral', detail: 'Not ready for merge' });
    }

    // 6. Activity recency
    const lastUpdate = daysSince(pr.updatedAt);
    if (lastUpdate <= 2) {
      factors.push({ label: 'Active', impact: 'positive', detail: 'Updated recently' });
    } else if (lastUpdate > 14) {
      score -= 5;
      factors.push({
        label: 'Inactive',
        impact: 'negative',
        detail: `No activity in ${lastUpdate}d`,
      });
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine grade
  const grade = GRADE_THRESHOLDS.find(([threshold]) => score >= threshold)?.[1] || 'F';

  return { grade, score, factors };
}

/* ─── Formatting helpers ──────────────────────────────────────── */

export function formatSize(additions: number, deletions: number): string {
  const total = additions + deletions;
  if (total <= 50) return 'S';
  if (total <= 200) return 'M';
  if (total <= 500) return 'L';
  return 'XL';
}

export function sizeColor(additions: number, deletions: number): string {
  const total = additions + deletions;
  if (total <= 50) return 'text-success';
  if (total <= 200) return 'text-info';
  if (total <= 500) return 'text-warning';
  return 'text-error';
}
