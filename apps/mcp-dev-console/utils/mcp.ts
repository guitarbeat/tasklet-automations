/**
 * Re-exports from @mcp-dev-console/mcp-client package.
 * Keeps component imports clean (../utils/mcp).
 */
export {
  mcpRequest,
  initialize,
  listTools,
  callTool,
  clearSession,
  getSessionId,
  extractMcpText,
  extractMcpJson,
} from '../../../packages/mcp-client/src/client';
