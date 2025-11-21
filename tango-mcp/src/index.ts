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
import { validateAuthentication, getUserIdentifierFromAuth } from "./auth/validate-authentication.js";
import { createMcpRouter } from "./router/mcp-router.js";
// </mcp-auth:imports>
// <mcp-bindings:imports>
// Binding helper imports will be added here by add binding command
// </mcp-bindings:imports>
import { initializeEnvironment, validateEnvironment } from "./config/validate-env.js";

/**
 * Props interface for per-user configuration
 * Supports dual authentication: OAuth (for users) and MCP tokens (for Agent SDK)
 *
 * SECURITY: The Tango API key MUST only come from env.TANGO_API_KEY (server environment)
 * and should NEVER be provided by clients through headers or props.
 * This prevents unauthorized clients from using their own API keys or consuming the server's quota.
 */
export interface MCPProps extends Record<string, unknown> {
	/** OAuth user name (from Google OAuth flow) */
	name?: string;

	/** OAuth user email (from Google OAuth flow) */
	email?: string;

	/** OAuth access token (from Google OAuth flow) */
	accessToken?: string;

	/**
	 * MCP access token from x-mcp-access-token header (for Agent SDK)
	 * Extracted by mcp-header-extractor middleware
	 */
	mcpAccessToken?: string;

	/** Authentication method used for this session */
	authMethod?: "oauth" | "mcp-token" | "none";
}

/**
 * Main MCP Agent class
 *
 * Gateway Model: The server acts as an authenticated gateway to the Tango API.
 * Users must authenticate via OAuth (or MCP access token), and the server uses
 * its centralized TANGO_API_KEY to make API requests on their behalf.
 *
 * Configuration:
 * {
 *   "mcpServers": {
 *     "tango": {
 *       "command": "npx",
 *       "args": [
 *         "-y",
 *         "mcp-remote",
 *         "https://your-worker.workers.dev/sse"
 *       ]
 *     }
 *   }
 * }
 *
 * SECURITY: The Tango API key is server-managed (env.TANGO_API_KEY) and never
 * accepted from client headers or props.
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

		// STEP 1: Validate environment configuration at startup
		// This ensures all required configuration is present and valid
		try {
			initializeEnvironment(env);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error(`[Tango MCP] Environment validation failed: ${errorMessage}`);
			// Re-throw to prevent server from starting with invalid config
			throw new Error(`Environment configuration error: ${errorMessage}`);
		}

		// STEP 2: GATEWAY MODEL: Validate authentication
		// Every request must be authenticated (OAuth OR MCP token)
		let validatedUser: string;
		try {
			const authResult = await validateAuthentication(this.props, env);
			validatedUser = getUserIdentifierFromAuth(authResult);
			console.log(`[Tango MCP] Authentication successful: ${authResult.method}`);
			console.log(`[Tango MCP] User: ${validatedUser}`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error(`[Tango MCP] Authentication failed: ${errorMessage}`);
			throw new Error(errorMessage);
		}

		// Detect authentication method (OAuth for user identity)
		const authInfo = detectAuthMethod(this.props, env);

		// SECURITY: Always use server's API key from environment (never from client props)
		// The server acts as a gateway - clients authenticate themselves, but the server
		// uses its own API key to make requests to Tango API on their behalf
		const authToken = env.TANGO_API_KEY;

		// Initialize cache manager
		const cache = env.TANGO_CACHE ? createCacheManager(env) : undefined;

		// Register all tools with server's API key (from env.TANGO_API_KEY only)
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
 * OAuth Provider configuration for standard OAuth flows
 *
 * This OAuth Provider is used for OAuth-authenticated requests.
 * MCP token requests bypass this entirely via the router.
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
const oauthProvider = new OAuthProvider({
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	tokenEndpoint: "/token",
	apiHandlers: {
		"/sse": MCPServerAgent.serveSSE("/sse"),
		"/mcp": MCPServerAgent.serve("/mcp"),
	},
	defaultHandler: GoogleHandler as any,
});

/**
 * Main Worker export with OAuth bypass routing
 *
 * This implements dual authentication support:
 * 1. OAuth (Google) for user authentication in Claude Web/Code
 * 2. MCP tokens for programmatic Agent SDK access
 *
 * Routing Logic:
 * - Requests to /sse or /mcp WITH x-mcp-access-token header → Direct to Agent SDK (bypass OAuth)
 * - All other requests → Through OAuth Provider
 *
 * MCP Token Flow:
 * 1. Router detects x-mcp-access-token header
 * 2. Router injects token into ctx.props.mcpAccessToken
 * 3. Router calls Agent SDK handler directly (bypasses OAuth)
 * 4. Agent validates token in validateAuthentication()
 *
 * This architecture ensures MCP token requests are not blocked by OAuth validation,
 * while preserving the complete OAuth flow for standard authentication.
 *
 * Based on: working_documents/auth2_implementation/14-oauth-bypass-architecture.md
 */
export default createMcpRouter(oauthProvider);
