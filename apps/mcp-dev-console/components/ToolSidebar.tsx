import React, { useState, useMemo } from 'react';
import { Search, ChevronRight, ChevronDown, Zap } from 'lucide-react';
import { McpTool, PresetCall } from '../types';

interface Props {
  tools: McpTool[];
  presets: PresetCall[];
  selectedTool: string | null;
  onSelectTool: (name: string) => void;
  onRunPreset: (preset: PresetCall) => void;
  connected: boolean;
}

function categorize(tools: McpTool[]): Record<string, McpTool[]> {
  const cats: Record<string, McpTool[]> = {};
  for (const tool of tools) {
    const n = tool.name.toLowerCase();
    let cat = 'Other';
    if (n.includes('transaction')) cat = 'Transactions';
    else if (n.includes('account') || n.includes('balance')) cat = 'Accounts';
    else if (
      n.includes('budget') ||
      n.includes('spending') ||
      n.includes('monthly') ||
      n.includes('financial') ||
      n.includes('net-worth') ||
      n.includes('savings')
    )
      cat = 'Analytics';
    else if (n.includes('categor')) cat = 'Categories';
    else if (n.includes('payee')) cat = 'Payees';
    else if (n.includes('rule')) cat = 'Rules';
    else if (n.includes('schedule')) cat = 'Schedules';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(tool);
  }
  // Sort each category alphabetically
  for (const key of Object.keys(cats)) {
    cats[key].sort((a, b) => a.name.localeCompare(b.name));
  }
  const order = [
    'Transactions',
    'Accounts',
    'Analytics',
    'Categories',
    'Payees',
    'Rules',
    'Schedules',
    'Other',
  ];
  const sorted: Record<string, McpTool[]> = {};
  for (const key of order) {
    if (cats[key]?.length) sorted[key] = cats[key];
  }
  return sorted;
}

const CAT_ICONS: Record<string, string> = {
  Transactions: '📄',
  Accounts: '🏦',
  Analytics: '📊',
  Categories: '🏷️',
  Payees: '👤',
  Rules: '⚙️',
  Schedules: '📅',
  Other: '🔧',
};

export const ToolSidebar: React.FC<Props> = ({
  tools,
  presets,
  selectedTool,
  onSelectTool,
  onRunPreset,
  connected,
}) => {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    if (!search) return tools;
    const q = search.toLowerCase();
    return tools.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q),
    );
  }, [tools, search]);

  const categories = useMemo(() => categorize(filtered), [filtered]);

  const presetCats = useMemo(() => {
    const map: Record<string, PresetCall[]> = {};
    for (const p of presets) {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    }
    return map;
  }, [presets]);

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="relative shrink-0">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/30"
        />
        <input
          type="text"
          placeholder="Filter tools…"
          className="input input-bordered input-xs w-full pl-8 font-mono text-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto thin-scroll">
        <div className="text-[10px] uppercase tracking-wider text-base-content/30 font-bold px-1 mb-1">
          Tools ({filtered.length})
        </div>
        {(Object.entries(categories) as Array<[string, McpTool[]]>).map(([cat, catTools]) => (
          <div key={cat} className="mb-0.5">
            <button
              className="flex items-center gap-1 w-full text-left px-1 py-0.5 hover:bg-base-200 rounded text-xs font-semibold text-base-content/60"
              onClick={() => setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }))}
            >
              {collapsed[cat] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              <span>{CAT_ICONS[cat] || '📦'}</span>
              {cat}
              <span className="text-base-content/30 ml-auto text-[10px]">{catTools.length}</span>
            </button>
            {!collapsed[cat] && (
              <div className="ml-3">
                {catTools.map((tool) => (
                  <button
                    key={tool.name}
                    className={`flex items-center w-full text-left px-2 py-0.5 rounded text-[11px] font-mono truncate transition-colors ${
                      selectedTool === tool.name
                        ? 'bg-primary/15 text-primary font-semibold'
                        : 'hover:bg-base-200 text-base-content/60'
                    }`}
                    onClick={() => onSelectTool(tool.name)}
                    title={tool.description}
                  >
                    {tool.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="border-t border-base-300 mt-2 pt-2">
          <div className="text-[10px] uppercase tracking-wider text-base-content/30 font-bold px-1 mb-1 flex items-center gap-1">
            <Zap size={10} /> Quick Presets
          </div>
          {(Object.entries(presetCats) as Array<[string, PresetCall[]]>).map(
            ([cat, catPresets]) => (
              <div key={cat} className="mb-1">
                <div className="text-[10px] uppercase text-base-content/20 px-1">{cat}</div>
                {catPresets.map((preset) => (
                  <button
                    key={preset.id}
                    className="flex items-center gap-1.5 w-full text-left px-2 py-0.5 rounded text-[11px] hover:bg-base-200 text-base-content/60 disabled:opacity-30"
                    onClick={() => onRunPreset(preset)}
                    disabled={!connected}
                    title={preset.description}
                  >
                    <span>{preset.icon}</span>
                    <span className="truncate">{preset.label}</span>
                  </button>
                ))}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
};
