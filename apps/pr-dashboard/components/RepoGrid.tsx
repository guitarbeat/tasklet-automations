import React from 'react';
import { GitPullRequest, CheckCircle } from 'lucide-react';
import { MonitoredRepo } from '../types';

interface RepoGridProps {
  repos: MonitoredRepo[];
  prCounts: Record<string, number>;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'badge-error',
  high: 'badge-warning',
  medium: 'badge-info',
  low: 'badge-ghost',
};

export const RepoGrid: React.FC<RepoGridProps> = ({ repos, prCounts }) => {
  const cleanCount = repos.filter((r) => (prCounts[r.repo] ?? 0) === 0).length;
  const totalOpen = repos.reduce((sum, r) => sum + (prCounts[r.repo] ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-sm">
          <span className="text-success">{cleanCount} clean</span>
          <span className="text-base-content/40">·</span>
          <span className="text-warning">{totalOpen} open PRs</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {repos.map((repo) => {
          const count = prCounts[repo.repo] ?? 0;
          return (
            <div key={repo.repo} className="card bg-base-200 hover:bg-base-300 transition-colors">
              <div className="card-body p-3 flex-row items-center gap-3">
                {count === 0 ? (
                  <CheckCircle size={14} className="text-success opacity-80" />
                ) : (
                  <GitPullRequest size={14} className="text-warning opacity-80" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{repo.repo}</span>
                    <span
                      className={`badge badge-xs ${PRIORITY_COLORS[repo.priority] ?? 'badge-ghost'}`}
                    >
                      {repo.priority}
                    </span>
                  </div>
                  {repo.notes && (
                    <div className="text-xs text-base-content/40 truncate mt-0.5">{repo.notes}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {count === 0 ? (
                    <span className="text-success text-sm font-medium">✓ clean</span>
                  ) : (
                    <span className="badge badge-warning badge-sm">{count} open</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
