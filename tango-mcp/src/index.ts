/**
 * tango-mcp - Cloudflare Workers MCP Server
 *
 * Entry point for the MCP server running on Cloudflare Workers.
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerHealthTool } from "./tools/health.js";
import { registerSearchContractsTool } from "./tools/search-contracts.js";
import { registerSearchIDVsTool } from "./tools/search-idvs.js";
import { registerSearchSubawardsTool } from "./tools/search-subawards.js";
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
import { registerLookupAgencyTool } from "./tools/lookup-agency.js";
import { registerGetCompanyIntelligenceTool } from "./tools/get-company-intelligence.js";
import { createCacheManager } from "./cache/kv-cache.js";
// <mcp-auth:imports>
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { GoogleHandler } from "./auth/google-handler.js";
import type { Props as OAuthProps } from "./auth/utils.js";
import { detectAuthMethod, getAuthToken, getUserIdentifier } from "./auth/auth-detector.js";
// </mcp-auth:imports>
// <mcp-bindings:imports>
// Binding helper imports will be added here by add binding command
// </mcp-bindings:imports>

/**
 * Props interface for per-user configuration
 * Supports both API key and OAuth authentication
 */
export interface MCPProps extends Record<string, unknown> {
	/** User's Tango API key from x-tango-api-key header (API key auth) */
	tangoApiKey?: string;

	/** OAuth user name (from Google OAuth flow) */
	name?: string;

	/** OAuth user email (from Google OAuth flow) */
	email?: string;

	/** OAuth access token (from Google OAuth flow) */
	accessToken?: string;

	/** Authentication method used for this session */
	authMethod?: "api-key" | "oauth" | "none";
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

		// Detect authentication method (OAuth or API key)
		const authInfo = detectAuthMethod(
			this.props,
			env as unknown as Record<string, unknown> & { TANGO_API_KEY?: string },
		);

		// Get the appropriate auth token (OAuth or API key)
		const authToken = getAuthToken(authInfo);

		// Log authentication method for debugging
		console.log(`[Tango MCP] Auth method: ${authInfo.method}`);
		if (authInfo.userEmail || authInfo.userName) {
			console.log(`[Tango MCP] User: ${getUserIdentifier(authInfo)}`);
		}

		// Initialize cache manager
		const cache = env.TANGO_CACHE ? createCacheManager(env) : undefined;

		// Register all tools with unified auth token (OAuth or API key)
		registerHealthTool(this.server);
		registerSearchContractsTool(this.server, env, cache, authToken);
		registerSearchIDVsTool(this.server, env, cache, authToken);
		registerSearchSubawardsTool(this.server, env, cache, authToken);
		registerSearchGrantsTool(this.server, env, cache, authToken);
		registerGetVendorProfileTool(this.server, env, cache, authToken);
		registerSearchOpportunitiesTool(this.server, env, cache, authToken);
		registerGetSpendingSummaryTool(this.server, env, cache, authToken);
		registerGetContractDetailTool(this.server, env, cache, authToken);
		registerGetGrantDetailTool(this.server, env, cache, authToken);
		registerGetOpportunityDetailTool(this.server, env, cache, authToken);
		registerGetAgencyAnalyticsTool(this.server, env, cache, authToken);
		registerSearchForecastsTool(this.server, env, cache, authToken);
		registerGetForecastDetailTool(this.server, env, cache, authToken);
		registerLookupAgencyTool(this.server, env, cache, authToken);
		registerGetCompanyIntelligenceTool(this.server, env, cache, authToken);
	}
}

/**
 * Health check and static routes handler
 * Used as defaultHandler for OAuthProvider to handle non-OAuth routes
 */
const staticRoutesHandler = {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

		// SSE and MCP endpoints are handled by OAuthProvider's apiHandlers
		// OAuth endpoints are handled by GoogleHandler (passed to OAuthProvider)
		// This handler only processes static routes like /health

		// 404 for all other routes
		return new Response("Not Found", { status: 404 });
	},
};

/**
 * OAuth Provider export - Full Google OAuth integration
 *
 * This wraps the MCP server with Google OAuth authentication.
 *
 * OAuth Flow:
 * 1. Client discovers OAuth endpoints via /.well-known/oauth-authorization-server
 * 2. Client initiates OAuth by navigating to /authorize
 * 3. User approves access via Google OAuth
 * 4. After authentication, user props (name, email, accessToken) are encrypted and passed to MCP agent
 * 5. Client accesses /sse or /mcp with authenticated credentials
 *
 * Environment variables required:
 * - GOOGLE_CLIENT_ID: Google OAuth client ID
 * - GOOGLE_CLIENT_SECRET: Google OAuth client secret
 * - OAUTH_KV: KV namespace for OAuth state storage
 * - COOKIE_ENCRYPTION_KEY: Key for encrypting session cookies
 * - HOSTED_DOMAIN (optional): Restrict to specific Google Workspace domain
 */
export default new OAuthProvider({
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	tokenEndpoint: "/token",
	apiHandlers: {
		"/sse": MCPServerAgent.serveSSE("/sse"),
		"/mcp": MCPServerAgent.serve("/mcp"),
	},
	defaultHandler: GoogleHandler as any,
});
