/**
 * Integration Test Configuration
 */

import { MCPClientAdapter } from "./adapters/client-adapter.js";

/**
 * Default server URL for integration tests
 * Using SSE endpoint for Cloudflare Workers deployment
 */
export const DEFAULT_SERVER_URL =
	process.env.MCP_SERVER_URL || "http://localhost:8788/sse";

/**
 * Default timeout for tool calls (milliseconds)
 */
export const DEFAULT_TIMEOUT = 30000;

/**
 * Client factory function
 */
export function createClient(serverUrl?: string): MCPClientAdapter {
	return new MCPClientAdapter(serverUrl || DEFAULT_SERVER_URL);
}
