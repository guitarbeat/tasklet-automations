export type AgentType = 'sentinel' | 'bolt' | 'palette' | 'other';
export type Staleness = 'current' | 'stale' | 'dead';
export type QueueState = 'queued' | 'active' | 'resolved' | 'failed' | 'skipped';
export type Filter = 'all' | 'current' | 'stale' | 'dead';
export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type ReviewStatus = 'APPROVED' | 'CHANGES_REQUESTED' | 'PENDING' | 'NO_REVIEWS';

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
  // Detailed fields (populated from github_get_pull_request)
  detail?: PRDetail;
}

export interface PRDetail {
  draft: boolean;
  labels: string[];
  additions: number;
  deletions: number;
  changedFiles: number;
  mergedAt: string | null;
  closedAt: string | null;
  reviewStatus: ReviewStatus;
  approvedBy: string[];
  changesRequestedBy: string[];
  totalReviews: number;
}

export interface HealthScore {
  grade: HealthGrade;
  score: number; // 0-100
  factors: HealthFactor[];
}

export interface HealthFactor {
  label: string;
  impact: 'positive' | 'neutral' | 'negative';
  detail: string;
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

export interface TokenStatus {
  configured: boolean;
  login?: string;
  last4?: string;
  savedAt?: string;
  scopeNote?: string;
}

export interface JulesAuditStaleOutput {
  id: string;
  title: string;
  repo: string;
  branch: string;
  base: string;
  head: string;
  state: string;
}

export interface JulesAuditMisconfiguredPR {
  id: string;
  title: string;
  repo: string;
  pr: number;
  sessionBranch: string;
  prBranch: string;
  state: string;
}

export interface JulesAuditLingering {
  id: string;
  title: string;
  repo: string;
  pr: number;
  merged: boolean;
  state: string;
}

export interface JulesAuditData {
  generated_at: string;
  total_sessions: number;
  by_state: Record<string, number>;
  findings: {
    stale_outputs: JulesAuditStaleOutput[];
    misconfigured_active_prs: JulesAuditMisconfiguredPR[];
    lingering_closed_or_merged: JulesAuditLingering[];
  };
  counts: {
    stale_outputs: number;
    misconfigured_active_prs: number;
    lingering_closed_or_merged: number;
  };
  errors: unknown[];
}

export interface PRComment {
  id: number;
  pr_number: number;
  repo: string;
  author: string;
  author_type: 'jules' | 'bot' | 'human';
  body: string;
  created_at: string;
  updated_at: string;
  github_comment_id: number | null;
}
