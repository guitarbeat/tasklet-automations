import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LayoutDashboard, GitBranch, Activity } from 'lucide-react';
import { Overview } from './components/Overview';
import { RepoGrid } from './components/RepoGrid';
import { ActivityFeed } from './components/ActivityFeed';
import { dashboardData, DashboardData } from './data';

type Tab = 'overview' | 'repos' | 'activity';

function formatAge(isoStr: string): string {
  const ms = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TabBar: React.FC<{
  tab: Tab;
  setTab: (t: Tab) => void;
  repoCount: number;
  generatedAt: string | null;
}> = ({ tab, setTab, repoCount, generatedAt }) => (
  <div className="navbar bg-base-200 px-3 py-1 min-h-0 border-b border-base-300">
    <div className="flex-1">
      <div className="tabs tabs-boxed bg-transparent gap-1">
        <button
          className={`tab tab-sm gap-1 ${tab === 'overview' ? 'tab-active' : ''}`}
          onClick={() => setTab('overview')}
        >
          <LayoutDashboard size={14} />
          Overview
        </button>
        <button
          className={`tab tab-sm gap-1 ${tab === 'repos' ? 'tab-active' : ''}`}
          onClick={() => setTab('repos')}
        >
          <GitBranch size={14} />
          {repoCount > 0 ? `Repos (${repoCount})` : 'Repos'}
        </button>
        <button
          className={`tab tab-sm gap-1 ${tab === 'activity' ? 'tab-active' : ''}`}
          onClick={() => setTab('activity')}
        >
          <Activity size={14} />
          Activity
        </button>
      </div>
    </div>
    {generatedAt && (
      <span className="text-xs text-base-content/40" title={`Data generated: ${new Date(generatedAt).toLocaleString()}`}>
        {formatAge(generatedAt)}
      </span>
    )}
  </div>
);

const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('overview');
  const data = dashboardData;

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <TabBar
        tab={tab}
        setTab={setTab}
        repoCount={data.repos.length}
        generatedAt={data.generatedAt}
      />

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'overview' ? (
          <Overview
            stats={data.stats}
            triggerRuns={data.triggerRuns}
            totalMerged={data.totalMerged}
            totalClosed={data.totalClosed}
          />
        ) : tab === 'repos' ? (
          <RepoGrid repos={data.repos} prCounts={data.prCounts} />
        ) : (
          <ActivityFeed actions={data.actions} sessions={data.sessions} />
        )}
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
