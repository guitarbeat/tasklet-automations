export type AgentType = 'sentinel' | 'bolt' | 'palette' | 'other';
export type Staleness = 'current' | 'stale' | 'dead';
export type QueueState = 'queued' | 'active' | 'resolved' | 'failed' | 'skipped';
export type Filter = 'all' | 'current' | 'stale' | 'dead';

export interface PullRequest {
  number: number;
  title: string;
  repo: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  baseSha: string;
  headBranch: string;
  url: string;
  agentType: AgentType;
}

export interface QueueItem {
  id: number;
  pr_number: number;
  repo: string;
  state: QueueState;
  priority: number;
  ping_count: number;
  first_pinged_at: string | null;
  last_pinged_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepoHealth {
  name: string;
  total: number;
  current: number;
  stale: number;
  dead: number;
  healthPct: number;
}

export interface QueueActions {
  queuePR: (pr: PullRequest) => void;
  queueAllStale: () => void;
  activatePR: (item: QueueItem) => void;
  resolvePR: (item: QueueItem, resolution: string) => void;
  skipPR: (item: QueueItem) => void;
  failPR: (item: QueueItem) => void;
  changePriority: (item: QueueItem, delta: number) => void;
  removeFromQueue: (item: QueueItem) => void;
}

export interface ActivityLogEntry {
  id: number;
  queue_item_id: number | null;
  pr_number: number;
  repo: string;
  action: string;
  details: string | null;
  created_at: string;
}
