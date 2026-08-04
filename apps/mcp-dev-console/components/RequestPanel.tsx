import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Play,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  FileJson,
  Terminal,
  Code,
} from 'lucide-react';
import { McpTool, ServerConfig, ResponseTab, HistoryEntry, SchemaProperty } from '../types';
import { callTool, extractMcpText } from '../utils/mcp';

interface Props {
  tool: McpTool | null;
  config: ServerConfig;
  onLog: (method: string, body: string, status: 'success' | 'error', durationMs?: number) => void;
  onHistory: (entry: HistoryEntry) => void;
  initialArgs?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function SchemaTable({ schema }: { schema: McpTool['inputSchema'] }) {
  if (!schema?.properties) return null;
  const required = new Set(schema.required || []);
  const entries = Object.entries(schema.properties);
  if (entries.length === 0)
    return <div className="text-xs text-base-content/40 italic">No parameters</div>;
  return (
    <div className="overflow-x-auto">
      <table className="table table-xs w-full">
        <thead>
          <tr className="text-[10px] uppercase text-base-content/40">
            <th className="font-semibold">Param</th>
            <th className="font-semibold">Type</th>
            <th className="font-semibold">Description</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, prop]) => (
            <tr key={name} className="hover">
              <td className="font-mono text-xs">
                {name}
                {required.has(name) && <span className="text-error ml-0.5">*</span>}
              </td>
              <td className="text-xs text-base-content/50">
                {prop.type || 'any'}
                {prop.enum && (
                  <span className="text-info ml-1 text-[10px]">[{prop.enum.join('|')}]</span>
                )}
              </td>
              <td
                className="text-xs text-base-content/50 max-w-[200px] truncate"
                title={prop.description}
              >
                {prop.description || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const RequestPanel: React.FC<Props> = ({ tool, config, onLog, onHistory, initialArgs }) => {
  const [args, setArgs] = useState('{}');
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<'success' | 'error' | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [responseTab, setResponseTab] = useState<ResponseTab>('formatted');
  const [schemaOpen, setSchemaOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const lastToolRef = useRef<string | null>(null);
  const historyIdRef = useRef(0);

  // Update args when tool or preset changes
  useEffect(() => {
    if (!tool) return;

    if (tool.name !== lastToolRef.current) {
      lastToolRef.current = tool.name;
      setResponse(null);
      setResponseStatus(null);
      setDurationMs(null);
    }

    if (initialArgs !== undefined) {
      setArgs(initialArgs);
      return;
    }

    // Generate defaults from schema
    const props = tool.inputSchema?.properties;
    const req = new Set(tool.inputSchema?.required || []);
    if (!props || Object.keys(props).length === 0) {
      setArgs('{}');
      return;
    }
    const defaults: Record<string, unknown> = {};
    const entries = Object.entries(props) as Array<[string, SchemaProperty]>;
    for (const [name, prop] of entries) {
      if (req.has(name)) {
        if (prop.default !== undefined) defaults[name] = prop.default;
        else if (prop.enum) defaults[name] = prop.enum[0];
        else if (prop.type === 'number' || prop.type === 'integer') defaults[name] = 0;
        else if (prop.type === 'boolean') defaults[name] = false;
        else if (prop.type === 'array') defaults[name] = [];
        else defaults[name] = '';
      }
    }
    setArgs(JSON.stringify(defaults, null, 2));
  }, [tool?.name, initialArgs]);

  const handleRun = useCallback(async () => {
    if (!tool) return;
    setRunning(true);
    setResponse(null);
    setResponseStatus(null);
    const startTime = Date.now();

    try {
      let parsedArgs: Record<string, unknown>;
      try {
        parsedArgs = JSON.parse(args);
      } catch {
        throw new Error('Invalid JSON in arguments');
      }

      const res = await callTool(config, tool.name, parsedArgs);
      const text = extractMcpText(res.result);
      const dur = res.durationMs;

      let formatted = text;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch {}

      setResponse(formatted);
      setResponseStatus('success');
      setDurationMs(dur);
      onLog(`tools/call:${tool.name}`, formatted.slice(0, 300), 'success', dur);
      onHistory({
        id: ++historyIdRef.current,
        timestamp: new Date(),
        toolName: tool.name,
        args,
        durationMs: dur,
        status: 'success',
        response: formatted,
        responseSize: new Blob([formatted]).size,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const dur = Date.now() - startTime;
      setResponse(msg);
      setResponseStatus('error');
      setDurationMs(dur);
      onLog(`tools/call:${tool.name}`, msg, 'error', dur);
      onHistory({
        id: ++historyIdRef.current,
        timestamp: new Date(),
        toolName: tool.name,
        args,
        durationMs: dur,
        status: 'error',
        response: msg,
        responseSize: new Blob([msg]).size,
      });
    } finally {
      setRunning(false);
    }
  }, [tool, args, config, onLog, onHistory]);

  const generateCurl = useCallback(() => {
    if (!tool) return '';
    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(args || '{}');
    } catch {}
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: tool.name, arguments: parsedArgs },
    };
    return [
      `curl -X POST '${config.url}'`,
      `  -H 'Content-Type: application/json'`,
      config.bearerToken ? `  -H 'Authorization: Bearer ${config.bearerToken}'` : '',
      `  -d '${JSON.stringify(body)}'`,
    ]
      .filter(Boolean)
      .join(' \\\n');
  }, [tool, args, config]);

  const handleCopy = () => {
    const text = responseTab === 'curl' ? generateCurl() : response || '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!tool) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-base-content/20 gap-3">
        <Terminal size={48} strokeWidth={1} />
        <div className="text-center">
          <div className="text-sm font-medium">Select a tool or preset</div>
          <div className="text-xs mt-1 text-base-content/15">Browse the sidebar to get started</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2 p-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h2 className="font-mono font-bold text-sm text-primary truncate">{tool.name}</h2>
          {tool.description && (
            <p className="text-xs text-base-content/50 mt-0.5 line-clamp-2">{tool.description}</p>
          )}
        </div>
        <button
          className={`btn btn-sm gap-1.5 shrink-0 ${running ? 'btn-disabled' : 'btn-primary'}`}
          onClick={handleRun}
          disabled={running}
        >
          {running ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <Play size={13} fill="currentColor" />
          )}
          {running ? 'Running…' : 'Run'}
        </button>
      </div>

      {/* Schema */}
      <div className="shrink-0">
        <button
          className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-base-content/40 font-bold hover:text-base-content/60"
          onClick={() => setSchemaOpen((s) => !s)}
        >
          {schemaOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          Schema
        </button>
        {schemaOpen && (
          <div className="mt-1 bg-base-200 rounded-lg p-2">
            <SchemaTable schema={tool.inputSchema} />
          </div>
        )}
      </div>

      {/* Args */}
      <div className="shrink-0">
        <div className="text-[10px] uppercase tracking-wider text-base-content/40 font-bold mb-1">
          Arguments
        </div>
        <textarea
          className="textarea textarea-bordered w-full font-mono text-xs leading-relaxed resize-none bg-base-200"
          rows={Math.min(Math.max(args.split('\n').length, 3), 8)}
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* Response */}
      {(response !== null || running) && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center gap-2 shrink-0 mb-1 flex-wrap">
            <div className="text-[10px] uppercase tracking-wider text-base-content/40 font-bold">
              Response
            </div>
            {responseStatus === 'success' && <CheckCircle size={12} className="text-success" />}
            {responseStatus === 'error' && <XCircle size={12} className="text-error" />}
            {durationMs !== null && (
              <div className="flex items-center gap-0.5 text-[10px] text-base-content/40">
                <Clock size={9} />
                {durationMs}ms
              </div>
            )}
            {response && (
              <div className="text-[10px] text-base-content/30">
                {formatBytes(new Blob([response]).size)}
              </div>
            )}
            <div className="ml-auto flex gap-0.5">
              {(['formatted', 'raw', 'curl'] as ResponseTab[]).map((tab) => (
                <button
                  key={tab}
                  className={`btn btn-xs gap-0.5 ${responseTab === tab ? 'btn-primary btn-outline' : 'btn-ghost'}`}
                  onClick={() => setResponseTab(tab)}
                >
                  {tab === 'formatted' ? (
                    <FileJson size={10} />
                  ) : tab === 'raw' ? (
                    <Code size={10} />
                  ) : (
                    <Terminal size={10} />
                  )}
                  <span className="text-[10px]">{tab}</span>
                </button>
              ))}
              <button className="btn btn-xs btn-ghost" onClick={handleCopy} title="Copy">
                {copied ? <CheckCircle size={11} className="text-success" /> : <Copy size={11} />}
              </button>
            </div>
          </div>

          <div
            className={`flex-1 min-h-0 rounded-lg p-3 overflow-auto thin-scroll font-mono text-xs whitespace-pre-wrap break-all ${
              responseStatus === 'error'
                ? 'bg-error/10 border border-error/20 text-error'
                : 'bg-base-200 text-base-content/80'
            }`}
          >
            {running ? (
              <div className="flex items-center gap-2 text-base-content/40">
                <span className="loading loading-dots loading-xs" />
                Executing {tool.name}…
              </div>
            ) : responseTab === 'curl' ? (
              generateCurl()
            ) : (
              response
            )}
          </div>
        </div>
      )}
    </div>
  );
};
