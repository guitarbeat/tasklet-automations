export interface ServerConfig {
  url: string;
  bearerToken?: string;
}

export interface SchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: { type?: string };
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, SchemaProperty>;
    required?: string[];
  };
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LogEntry {
  id: number;
  timestamp: Date;
  method: string;
  direction: 'sent' | 'received';
  body: string;
  status: 'success' | 'error';
  durationMs?: number;
}

export interface HistoryEntry {
  id: number;
  timestamp: Date;
  toolName: string;
  args: string;
  durationMs: number;
  status: 'success' | 'error';
  response: string;
  responseSize: number;
}

export interface PresetCall {
  id: string;
  label: string;
  description: string;
  icon: string;
  tool: string;
  args: Record<string, unknown>;
  category: string;
}

export type ResponseTab = 'formatted' | 'raw' | 'curl';

export type AppView = 'console' | 'audit';
