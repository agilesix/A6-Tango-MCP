/**
 * tango-mcp - Cloudflare Workers MCP Server
 *
 * Entry point for the MCP server running on Cloudflare Workers.
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerHealthTool } from "./tools/health.js";
import { registerSearchContractsTool } from "./tools/search-contracts.js";
import { registerSearchGrantsTool } from "./tools/search-grants.js";
// <mcp-auth:imports>
// Auth imports will be added here by add-auth command
// </mcp-auth:imports>
// <mcp-bindings:imports>
// Binding helper imports will be added here by add binding command
// </mcp-bindings:imports>

/**
 * Main MCP Agent class
 */
export class MCPServerAgent extends McpAgent<Env> {
	server = new McpServer({
		name: "tango-mcp",
		version: "1.0.0",
	});

	async init() {
		// Register all tools
		registerHealthTool(this.server);
		registerSearchContractsTool(this.server);
		registerSearchGrantsTool(this.server);
	}
}

/**
 * Cloudflare Workers fetch handler
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// <mcp-auth:middleware>
		// Auth middleware will be added here by add-auth command
		// </mcp-auth:middleware>

		const url = new URL(request.url);

		// Route: Health check
		if (url.pathname === "/health") {
			const healthData = {
				status: "healthy",
				service: "tango-mcp",
				version: "1.0.0",
				timestamp: new Date().toISOString(),
				environment: env.TANGO_API_BASE_URL ? "configured" : "not_configured",
				services: {
					cache_kv: "unknown" as string,
					tango_api: env.TANGO_API_BASE_URL ? "configured" : "not_configured",
				},
			};

			// Check KV namespace availability
			try {
				if (env.TANGO_CACHE) {
					// Try a simple operation to verify KV is accessible
					await env.TANGO_CACHE.put("health_check", "ok", { expirationTtl: 60 });
					const result = await env.TANGO_CACHE.get("health_check");
					healthData.services.cache_kv = result === "ok" ? "available" : "error";
				} else {
					healthData.services.cache_kv = "not_configured";
				}
			} catch (error) {
				healthData.services.cache_kv = "error";
				healthData.status = "degraded";
			}

			return new Response(
				JSON.stringify(healthData),
				{
					status: healthData.status === "healthy" ? 200 : 503,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Route: SSE/MCP endpoint
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MCPServerAgent.serveSSE('/sse').fetch(request, env, ctx);
		}

		// Route: Standard MCP endpoint (JSON-RPC)
		if (url.pathname === "/mcp") {
			return MCPServerAgent.serve('/mcp').fetch(request, env, ctx);
		}

		// 404 for all other routes
		return new Response("Not Found", { status: 404 });
	},
};
