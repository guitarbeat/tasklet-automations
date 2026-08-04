import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Wifi, WifiOff, Loader2, Settings, X, Terminal, ClipboardCheck } from 'lucide-react';
import { ToolSidebar } from './components/ToolSidebar';
import { RequestPanel } from './components/RequestPanel';
import { HistoryBar } from './components/HistoryBar';
import { SchemaAudit } from './components/SchemaAudit';
import { McpTool, LogEntry, ConnectionStatus, ServerConfig, HistoryEntry, AppView } from './types';
import { initialize, listTools, clearSession } from './utils/mcp';
import { PRESETS } from './utils/presets';
import './styles.css';

const DEFAULT_URL = '';
const DEFAULT_TOKEN = '';

const App: React.FC<{}> = () => {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [tools, setTools] = useState<McpTool[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [presetArgs, setPresetArgs] = useState<string | undefined>(undefined);
  const [showSettings, setShowSettings] = useState(!DEFAULT_URL);
  const [view, setView] = useState<AppView>('console');
  const logIdRef = useRef(0);
  const connectingRef = useRef(false);

  const addLog = useCallback(
    (method: string, body: string, logStatus: 'success' | 'error', durationMs?: number) => {
      setLogs((prev) => [
        ...prev,
        {
          id: Date.now() + logIdRef.current++,
          timestamp: new Date(),
          method,
          direction: 'received' as const,
          body,
          status: logStatus,
          durationMs,
        },
      ]);
    },
    [],
  );

  const config: ServerConfig = useMemo(() => ({ url, bearerToken: token }), [url, token]);

  const handleConnect = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setStatus('connecting');
    setTools([]);
    try {
      const initResult = await initialize(config);
      addLog(
        'initialize',
        JSON.stringify(initResult.serverInfo, null, 2),
        'success',
        initResult.durationMs,
      );
      const { tools: toolList, durationMs } = await listTools(config);
      setTools(toolList);
      addLog('tools/list', `Found ${toolList.length} tools`, 'success', durationMs);
      setStatus('connected');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus('error');
      addLog('initialize', msg, 'error');
    } finally {
      connectingRef.current = false;
    }
  }, [config, addLog]);

  const handleDisconnect = useCallback(() => {
    clearSession();
    setStatus('disconnected');
    setTools([]);
  }, []);

  useEffect(() => {
    if (DEFAULT_URL) void handleConnect();
  }, []);

  const addHistory = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => [...prev, entry]);
  }, []);

  const handleRunPreset = useCallback((preset: (typeof PRESETS)[0]) => {
    setSelectedTool(preset.tool);
    setPresetArgs(JSON.stringify(preset.args, null, 2));
  }, []);

  const handleReplay = useCallback((entry: HistoryEntry) => {
    setSelectedTool(entry.toolName);
    setPresetArgs(entry.args);
  }, []);

  const selected = tools.find((t) => t.name === selectedTool) ?? null;

  const sc: Record<ConnectionStatus, { color: string; label: string; dot: string }> = {
    connected: { color: 'text-success', label: 'connected', dot: 'bg-success' },
    connecting: { color: 'text-warning', label: 'connecting…', dot: 'bg-warning animate-pulse' },
    disconnected: {
      color: 'text-base-content/40',
      label: 'disconnected',
      dot: 'bg-base-content/20',
    },
    error: { color: 'text-error', label: 'error', dot: 'bg-error' },
  };
  const s = sc[status];

  return (
    <div className="flex flex-col h-screen bg-base-100 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center bg-base-200 h-10 px-3 border-b border-base-300 shrink-0 gap-2">
        <Terminal size={15} className="text-primary shrink-0" />
        <span className="font-bold text-sm tracking-tight shrink-0">MCP Dev Console</span>
        <div className="flex items-center gap-0.5 ml-3">
          <button
            className={`btn btn-xs gap-1 ${view === 'console' ? 'btn-primary btn-outline' : 'btn-ghost'}`}
            onClick={() => setView('console')}
          >
            <Terminal size={11} />
            <span className="text-[10px]">Console</span>
          </button>
          <button
            className={`btn btn-xs gap-1 ${view === 'audit' ? 'btn-primary btn-outline' : 'btn-ghost'}`}
            onClick={() => setView('audit')}
            disabled={tools.length === 0}
            title={tools.length === 0 ? 'Connect to run audit' : 'Schema audit report'}
          >
            <ClipboardCheck size={11} />
            <span className="text-[10px]">Audit</span>
          </button>
        </div>
        <div className="flex-1" />
        <div className={`flex items-center gap-1.5 text-xs ${s.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {status === 'connecting' && <Loader2 size={11} className="animate-spin" />}
          <span className="font-mono text-[11px]">{s.label}</span>
          {tools.length > 0 && (
            <span className="badge badge-xs badge-success font-mono">{tools.length}</span>
          )}
        </div>
        {status !== 'connecting' && (
          <button
            className="btn btn-ghost btn-xs gap-1"
            onClick={status === 'connected' ? handleDisconnect : handleConnect}
          >
            {status === 'connected' ? <WifiOff size={11} /> : <Wifi size={11} />}
          </button>
        )}
        <button
          className={`btn btn-ghost btn-xs ${showSettings ? 'btn-active' : ''}`}
          onClick={() => setShowSettings((v) => !v)}
        >
          <Settings size={13} />
        </button>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="bg-base-200 border-b border-base-300 px-3 py-2 flex gap-2 items-center shrink-0">
          <label className="input input-bordered input-xs flex items-center gap-2 flex-1 min-w-0">
            <span className="text-base-content/40 text-[10px] font-mono shrink-0">URL</span>
            <input
              className="grow min-w-0 font-mono"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={status === 'connected'}
            />
          </label>
          <label className="input input-bordered input-xs flex items-center gap-2 flex-1 min-w-0">
            <span className="text-base-content/40 text-[10px] font-mono shrink-0">TOKEN</span>
            <input
              className="grow min-w-0 font-mono"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={status === 'connected'}
            />
          </label>
          <button className="btn btn-ghost btn-xs" onClick={() => setShowSettings(false)}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* Main */}
      {view === 'console' ? (
        <>
          <div className="flex-1 min-h-0 flex overflow-hidden">
            <div className="w-48 shrink-0 border-r border-base-300 p-2 bg-base-100">
              <ToolSidebar
                tools={tools}
                presets={PRESETS}
                selectedTool={selectedTool}
                onSelectTool={(name) => {
                  setSelectedTool(name);
                  setPresetArgs(undefined);
                }}
                onRunPreset={handleRunPreset}
                connected={status === 'connected'}
              />
            </div>
            <div className="flex-1 min-w-0 min-h-0 bg-base-100">
              <RequestPanel
                tool={selected}
                config={config}
                onLog={addLog}
                onHistory={addHistory}
                initialArgs={presetArgs}
              />
            </div>
          </div>
          <HistoryBar history={history} onReplay={handleReplay} onClear={() => setHistory([])} />
        </>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          <SchemaAudit tools={tools} />
        </div>
      )}
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
