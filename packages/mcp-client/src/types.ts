/** MCP server connection config */
export interface ServerConfig {
  url: string;
  bearerToken?: string;
}

/** MCP tool definition (from tools/list) */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, SchemaProperty>;
    required?: string[];
  };
}

/** JSON Schema property descriptor */
export interface SchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: { type?: string };
}

/** Connection state machine */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
