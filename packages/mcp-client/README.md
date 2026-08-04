# @tasklet-automations/mcp-client

Lightweight TypeScript client for [Model Context Protocol](https://modelcontextprotocol.io/) servers over HTTP+SSE.

## Features

- **Session management** — Handles `Mcp-Session-Id` header automatically
- **JSON-RPC 2.0** — Proper request/response envelope handling
- **Cold-start resilient** — Works with servers that hibernate (e.g., Render free tier)
- **Zero dependencies** — Uses only curl via sandboxed bridge

## API

### `initialize(config)` → `{ serverInfo, sessionId, durationMs }`

Start a session: sends `initialize` + `notifications/initialized`.

### `listTools(config)` → `{ tools, durationMs }`

Fetch the server's tool catalog.

### `callTool(config, toolName, args)` → `{ result, durationMs }`

Execute a tool. Throws on MCP-level errors.

### `mcpRequest(config, method, params)` → `{ result, error, raw, sessionId, durationMs }`

Low-level JSON-RPC 2.0 request.

### `extractMcpText(result)` / `extractMcpJson<T>(result)`

Parse MCP `content[].text` responses.
