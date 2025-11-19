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
import { registerGetVendorProfileTool } from "./tools/get-vendor-profile.js";
import { registerSearchOpportunitiesTool } from "./tools/search-opportunities.js";
import { registerGetSpendingSummaryTool } from "./tools/get-spending-summary.js";
import { registerGetContractDetailTool } from "./tools/get-contract-detail.js";
import { registerGetGrantDetailTool } from "./tools/get-grant-detail.js";
import { registerGetOpportunityDetailTool } from "./tools/get-opportunity-detail.js";
import { registerGetAgencyAnalyticsTool } from "./tools/get-agency-analytics.js";
import { registerSearchForecastsTool } from "./tools/search-forecasts.js";
import { registerGetForecastDetailTool } from "./tools/get-forecast-detail.js";
import { createCacheManager } from "./cache/kv-cache.js";
// <mcp-auth:imports>
// Auth imports will be added here by add-auth command
// </mcp-auth:imports>
// <mcp-bindings:imports>
// Binding helper imports will be added here by add binding command
// </mcp-bindings:imports>

/**
 * Props interface for per-user configuration
 */
export interface MCPProps extends Record<string, unknown> {
	/** User's Tango API key from x-tango-api-key header */
	tangoApiKey?: string;
}

/**
 * Main MCP Agent class
 *
 * Supports per-user API keys via the tangoApiKey prop.
 * Users configure their API key using mcp-remote with custom headers:
 * {
 *   "mcpServers": {
 *     "tango": {
 *       "command": "npx",
 *       "args": [
 *         "-y",
 *         "mcp-remote",
 *         "https://your-worker.workers.dev/sse",
 *         "--header",
 *         "x-tango-api-key:YOUR_KEY_HERE"
 *       ]
 *     }
 *   }
 * }
 */
export class MCPServerAgent extends McpAgent<Env, Record<string, never>, MCPProps> {
	server = new McpServer({
		name: "tango-mcp",
		version: "1.0.0",
	});

	async init() {
		// Access env and props through the agent context
		// The McpAgent framework provides env and props through 'this' context during agent execution
		const env = (this as unknown as { env?: Env }).env || ({} as Env);

		// Get user's API key from props (extracted from x-tango-api-key header)
		const userApiKey = this.props?.tangoApiKey;

		// Initialize cache manager
		const cache = env.TANGO_CACHE ? createCacheManager(env) : undefined;

		// Register all tools with user's API key
		registerHealthTool(this.server);
		registerSearchContractsTool(this.server, env, cache, userApiKey);
		registerSearchGrantsTool(this.server, env, cache, userApiKey);
		registerGetVendorProfileTool(this.server, env, cache, userApiKey);
		registerSearchOpportunitiesTool(this.server, env, cache, userApiKey);
		registerGetSpendingSummaryTool(this.server, env, cache, userApiKey);
		registerGetContractDetailTool(this.server, env, cache, userApiKey);
		registerGetGrantDetailTool(this.server, env, cache, userApiKey);
		registerGetOpportunityDetailTool(this.server, env, cache, userApiKey);
		registerGetAgencyAnalyticsTool(this.server, env, cache, userApiKey);
		registerSearchForecastsTool(this.server, env, cache, userApiKey);
		registerGetForecastDetailTool(this.server, env, cache, userApiKey);
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
			const healthData: {
				status: string;
				service: string;
				version: string;
				timestamp: string;
				environment: string;
				services: {
					cache_kv: string;
					tango_api: string;
				};
				cache?: {
					enabled: boolean;
					ttl_seconds: number;
					total_keys?: number;
					by_tool?: Record<string, number>;
				};
			} = {
				status: "healthy",
				service: "tango-mcp",
				version: "1.0.0",
				timestamp: new Date().toISOString(),
				environment: env.TANGO_API_BASE_URL ? "configured" : "not_configured",
				services: {
					cache_kv: "unknown",
					tango_api: env.TANGO_API_BASE_URL ? "configured" : "not_configured",
				},
			};

			// Check KV namespace availability and get cache statistics
			try {
				if (env.TANGO_CACHE) {
					// Try a simple operation to verify KV is accessible
					await env.TANGO_CACHE.put("health_check", "ok", { expirationTtl: 60 });
					const result = await env.TANGO_CACHE.get("health_check");
					healthData.services.cache_kv = result === "ok" ? "available" : "error";

					// Get cache statistics if KV is available
					if (result === "ok") {
						const cache = createCacheManager(env);
						const stats = await cache.getStats();

						healthData.cache = {
							enabled: true,
							ttl_seconds: env.CACHE_TTL_SECONDS
								? Number.parseInt(env.CACHE_TTL_SECONDS, 10)
								: 300,
							total_keys: stats.total_keys,
							by_tool: stats.by_prefix,
						};
					}
				} else {
					healthData.services.cache_kv = "not_configured";
					healthData.cache = {
						enabled: false,
						ttl_seconds: 300,
					};
				}
			} catch (_error) {
				healthData.services.cache_kv = "error";
				healthData.status = "degraded";
			}

			return new Response(
				JSON.stringify(healthData, null, 2),
				{
					status: healthData.status === "healthy" ? 200 : 503,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Route: SSE/MCP endpoint
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			// Extract user's Tango API key from request headers
			const userTangoApiKey = request.headers.get("x-tango-api-key");

			// Create an augmented context with props containing the API key
			// The McpAgent framework expects user-specific data in ctx.props
			const ctxWithProps = {
				...ctx,
				props: {
					tangoApiKey: userTangoApiKey || undefined,
				} as MCPProps,
			};

			return MCPServerAgent.serveSSE('/sse').fetch(request, env, ctxWithProps);
		}

		// Route: Standard MCP endpoint (JSON-RPC)
		if (url.pathname === "/mcp") {
			return MCPServerAgent.serve('/mcp').fetch(request, env, ctx);
		}

		// 404 for all other routes
		return new Response("Not Found", { status: 404 });
	},
};
