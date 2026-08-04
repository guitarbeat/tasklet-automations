import { PullRequest, AgentType, RepoHealth, Staleness } from '../types';

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
