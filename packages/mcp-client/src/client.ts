import { ServerConfig, McpTool } from './types';

let requestId = 0;
let currentSessionId: string | null = null;

function nextId(): number {
  return ++requestId;
}

export function getSessionId(): string | null {
  return currentSessionId;
}

export function clearSession(): void {
  currentSessionId = null;
  requestId = 0;
}

/** Extract the text string from an MCP tools/call result */
export function extractMcpText(result: unknown): string {
  const r = result as { content?: Array<{ type: string; text: string }> } | null;
  if (r?.content && Array.isArray(r.content) && r.content.length > 0) {
    return r.content[0].text || '';
  }
  if (typeof result === 'string') return result;
  return JSON.stringify(result, null, 2);
}

/** Extract and parse JSON from an MCP tools/call result */
export function extractMcpJson<T>(result: unknown): T {
  const text = extractMcpText(result);
  return JSON.parse(text) as T;
}

export async function mcpRequest(
  config: ServerConfig,
  method: string,
  params?: Record<string, unknown>,
): Promise<{
  result?: unknown;
  error?: unknown;
  raw: string;
  sessionId?: string;
  durationMs: number;
}> {
  const startTime = Date.now();
  const id = nextId();
  const body: Record<string, unknown> = { jsonrpc: '2.0', id, method };
  if (params) body.params = params;

  const jsonBody = JSON.stringify(body);
  const reqFile = `/tmp/mcp_req_${id}.json`;
  const hdrFile = `/tmp/mcp_hdr_${id}.txt`;
  await window.tasklet.writeFileToDisk(reqFile, jsonBody);

  const headerFlags = [
    `-H 'Content-Type: application/json'`,
    `-H 'Accept: application/json, text/event-stream'`,
    config.bearerToken ? `-H 'Authorization: Bearer ${config.bearerToken}'` : '',
    currentSessionId ? `-H 'Mcp-Session-Id: ${currentSessionId}'` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const curlCmd = [
    'curl -s --max-time 30 -w "\\n---HTTP_CODE:%{http_code}---"',
    `-X POST '${config.url}'`,
    headerFlags,
    `-D ${hdrFile}`,
    `-d @${reqFile}`,
  ].join(' ');

  const res = await window.tasklet.runCommand(curlCmd, 35);

  try {
    const headersRes = await window.tasklet.runCommand(`cat ${hdrFile} 2>/dev/null`, 5);
    const match = headersRes.log.match(/mcp-session-id:\s*(\S+)/i);
    if (match) currentSessionId = match[1];
  } catch {
    /* ignore */
  }

  const durationMs = Date.now() - startTime;
  const log = res.log.trim();
  const codeMatch = log.match(/---HTTP_CODE:(\d+)---/);
  const httpCode = codeMatch ? parseInt(codeMatch[1]) : 0;
  const responseBody = log.replace(/\n?---HTTP_CODE:\d+---$/, '').trim();

  if (httpCode < 200 || httpCode >= 300) {
    return { error: { httpCode, body: responseBody }, raw: log, durationMs };
  }

  if (responseBody.startsWith('event:') || responseBody.includes('\nevent:')) {
    const lines = responseBody.split('\n');
    let lastData = '';
    for (const line of lines) {
      if (line.startsWith('data:')) lastData = line.slice(5).trim();
    }
    if (lastData) {
      try {
        const parsed = JSON.parse(lastData);
        return {
          result: parsed.result,
          error: parsed.error,
          raw: responseBody,
          sessionId: currentSessionId ?? undefined,
          durationMs,
        };
      } catch {
        return {
          result: lastData,
          raw: responseBody,
          sessionId: currentSessionId ?? undefined,
          durationMs,
        };
      }
    }
  }

  try {
    const parsed = JSON.parse(responseBody);
    return {
      result: parsed.result,
      error: parsed.error,
      raw: responseBody,
      sessionId: currentSessionId ?? undefined,
      durationMs,
    };
  } catch {
    return {
      result: responseBody,
      raw: responseBody,
      sessionId: currentSessionId ?? undefined,
      durationMs,
    };
  }
}

export async function initialize(
  config: ServerConfig,
): Promise<{ serverInfo: unknown; sessionId?: string; durationMs: number }> {
  clearSession();
  const res = await mcpRequest(config, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'mcp-dev-console', version: '3.0.0' },
  });
  if (res.error) throw new Error(JSON.stringify(res.error));

  try {
    await mcpRequest(config, 'notifications/initialized', {});
  } catch {
    /* notification — ok to fail */
  }

  return {
    serverInfo: res.result,
    sessionId: currentSessionId ?? undefined,
    durationMs: res.durationMs,
  };
}

export async function listTools(
  config: ServerConfig,
): Promise<{ tools: McpTool[]; durationMs: number }> {
  const res = await mcpRequest(config, 'tools/list', {});
  if (res.error) throw new Error(JSON.stringify(res.error));
  const result = res.result as { tools?: McpTool[] };
  return { tools: result?.tools || [], durationMs: res.durationMs };
}

export async function callTool(
  config: ServerConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ result: unknown; durationMs: number }> {
  const res = await mcpRequest(config, 'tools/call', { name: toolName, arguments: args });
  if (res.error) throw new Error(JSON.stringify(res.error));

  // MCP tool errors come back as result.isError=true with error details in content[0].text
  const r = res.result as {
    isError?: boolean;
    content?: Array<{ type: string; text: string }>;
  } | null;
  if (r?.isError) {
    let msg = `Tool "${toolName}" returned an error`;
    if (r.content?.[0]?.text) {
      try {
        const parsed = JSON.parse(r.content[0].text) as { message?: string; suggestion?: string };
        const inner = parsed.message ? (JSON.parse(parsed.message) as { message?: string }) : null;
        msg = inner?.message || parsed.message || msg;
        if (parsed.suggestion) msg += ` — ${parsed.suggestion}`;
      } catch {
        msg = r.content[0].text;
      }
    }
    throw new Error(msg);
  }

  return { result: res.result, durationMs: res.durationMs };
}
