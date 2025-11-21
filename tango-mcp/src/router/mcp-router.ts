/**
 * MCP Router with OAuth Bypass
 *
 * This module implements a custom routing layer that detects MCP tokens
 * and routes requests to either:
 * 1. Direct Agent SDK (when MCP token present) - bypasses OAuth Provider
 * 2. OAuth Provider (when OAuth credentials present) - uses OAuth
 *
 * Architecture:
 * - Routing decision happens at the Worker fetch handler level
 * - MCP token requests never reach OAuth Provider (can't be blocked)
 * - OAuth requests go through OAuth Provider as normal (no changes)
 * - Props are injected into ExecutionContext before calling Agent SDK
 *
 * Based on: working_documents/auth2_implementation/14-oauth-bypass-architecture.md
 *
 * @module router/mcp-router
 */

import type OAuthProvider from "@cloudflare/workers-oauth-provider";
import { MCPServerAgent } from "../index.js";
import type { Env } from "../types/env.js";

/**
 * Extended ExecutionContext that allows props injection.
 *
 * This is the same pattern used by OAuth Provider and Agent SDK.
 * The Agent SDK's serve() handlers read ctx.props and pass them
 * to getAgentByName(), which then creates/retrieves the Durable Object
 * with these props.
 *
 * Note: We don't extend ExecutionContext to avoid TypeScript conflicts.
 * Instead, we define the minimal interface we need and cast as needed.
 */
interface MutableExecutionContext {
	/**
	 * Application-specific properties passed to Agent instances.
	 * These props flow through the Agent SDK to the Agent's init() method.
	 */
	props?: Record<string, unknown>;

	// Preserve ExecutionContext methods
	waitUntil(promise: Promise<unknown>): void;
	passThroughOnException(): void;
}

/**
 * Checks if a request contains an MCP token in the x-mcp-access-token header.
 *
 * This is the routing decision point - requests with MCP tokens bypass OAuth,
 * requests without MCP tokens go through OAuth Provider.
 *
 * @param request - The incoming HTTP request
 * @returns true if x-mcp-access-token header is present and non-empty
 *
 * @example
 * ```typescript
 * const request = new Request('https://api.example.com/mcp', {
 *   headers: { 'x-mcp-access-token': 'mcp_v1_...' }
 * });
 * hasMcpToken(request); // true
 * ```
 */
function hasMcpToken(request: Request): boolean {
	const token = request.headers.get("x-mcp-access-token");
	return token !== null && token.length > 0;
}

/**
 * Handles requests authenticated with MCP tokens.
 *
 * This function bypasses the OAuth Provider completely and calls
 * the Agent SDK handlers directly. It:
 * 1. Extracts the MCP token from the request header
 * 2. Injects it into ExecutionContext.props
 * 3. Calls the appropriate Agent SDK handler (SSE or MCP)
 * 4. Returns the response from Agent SDK
 *
 * The Agent SDK will:
 * - Read ctx.props from ExecutionContext
 * - Pass props to getAgentByName()
 * - Create/retrieve Durable Object with props
 * - Call Agent's init() method with props.mcpAccessToken
 *
 * @param request - The incoming HTTP request
 * @param env - Cloudflare Workers environment bindings
 * @param ctx - Execution context for the request
 * @param path - The endpoint path ('/sse' or '/mcp')
 * @returns Response from Agent SDK handler
 *
 * @throws {Error} 401 if x-mcp-access-token header is missing
 *
 * @example
 * ```typescript
 * const response = await handleMcpTokenRoute(
 *   request,
 *   env,
 *   ctx,
 *   '/mcp'
 * );
 * // Agent SDK validates token in MCPServerAgent.init()
 * ```
 */
async function handleMcpTokenRoute(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
	path: string,
): Promise<Response> {
	const mcpToken = request.headers.get("x-mcp-access-token");

	if (!mcpToken) {
		// This should never happen because hasMcpToken() checks first,
		// but we validate again for safety
		return new Response(
			JSON.stringify({
				error: "Authentication required",
				message: "Missing x-mcp-access-token header",
			}),
			{
				status: 401,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	console.log("[MCP Router] MCP token authentication - bypassing OAuth");

	// Inject MCP token into props for Agent SDK
	// The Agent SDK's serve() handlers will read ctx.props
	// and pass them to getAgentByName(), which creates the Durable Object
	// with these props available to the Agent's init() method
	const mutableCtx = ctx as MutableExecutionContext;
	mutableCtx.props = {
		mcpAccessToken: mcpToken,
		authMethod: "mcp-token",
	};

	// Select correct Agent SDK handler based on path
	// These handlers are the same ones configured in OAuth Provider's apiHandlers
	const handler =
		path === "/sse"
			? MCPServerAgent.serveSSE("/sse")
			: MCPServerAgent.serve("/mcp");

	// Call Agent SDK handler directly (bypassing OAuth Provider)
	// Flow after this:
	// 1. Handler calls getAgentByName(namespace, sessionId, { props: ctx.props })
	// 2. Agent SDK creates/retrieves Durable Object with props
	// 3. Agent's init() receives props.mcpAccessToken
	// 4. Agent validates token in validateAuthentication()
	return handler.fetch(request, env, ctx);
}

/**
 * Handles requests authenticated with OAuth credentials.
 *
 * This function passes the request through to the OAuth Provider,
 * which will:
 * 1. Validate OAuth credentials (cookies, tokens)
 * 2. Extract user props (name, email, accessToken)
 * 3. Set ctx.props with OAuth data
 * 4. Call the appropriate apiHandler
 * 5. Agent SDK receives OAuth props
 *
 * This preserves the existing OAuth flow completely unchanged.
 *
 * @param request - The incoming HTTP request
 * @param env - Cloudflare Workers environment bindings
 * @param ctx - Execution context for the request
 * @param oauthProvider - Configured OAuth Provider instance
 * @returns Response from OAuth Provider (which may call Agent SDK)
 *
 * @example
 * ```typescript
 * const response = await handleOAuthRoute(
 *   request,
 *   env,
 *   ctx,
 *   oauthProvider
 * );
 * // OAuth Provider handles authentication and routing
 * ```
 */
async function handleOAuthRoute(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
	oauthProvider: OAuthProvider,
): Promise<Response> {
	console.log("[MCP Router] OAuth authentication");

	// Pass through to OAuth Provider
	// OAuth Provider handles:
	// - OAuth flow endpoints (/authorize, /token, /register, /.well-known/*)
	// - MCP endpoints with OAuth credentials (no MCP token)
	// - Static routes via defaultHandler (health check, etc.)
	return oauthProvider.fetch(request, env, ctx);
}

/**
 * Creates the main routing handler with OAuth bypass capability.
 *
 * This function returns a Cloudflare Workers fetch handler that routes
 * requests based on authentication method:
 *
 * Routing Logic:
 * - /sse or /mcp + x-mcp-access-token header → handleMcpTokenRoute (bypass OAuth)
 * - Everything else → handleOAuthRoute (use OAuth Provider)
 *
 * This ensures:
 * - MCP token requests bypass OAuth validation
 * - OAuth requests work unchanged
 * - No breaking changes to existing functionality
 *
 * @param oauthProvider - Configured OAuth Provider instance
 * @returns Worker fetch handler with OAuth bypass routing
 *
 * @example
 * ```typescript
 * // In index.ts
 * const oauthProvider = new OAuthProvider({
 *   apiHandlers: {
 *     "/sse": MCPServerAgent.serveSSE("/sse"),
 *     "/mcp": MCPServerAgent.serve("/mcp"),
 *   },
 *   defaultHandler: GoogleHandler
 * });
 *
 * export default createMcpRouter(oauthProvider);
 * ```
 */
export function createMcpRouter(
	oauthProvider: OAuthProvider,
): ExportedHandler<Env> {
	return {
		async fetch(
			request: Request,
			env: Env,
			ctx: ExecutionContext,
		): Promise<Response> {
			const url = new URL(request.url);

			// Check if this is an MCP endpoint (/sse or /mcp)
			const isMcpEndpoint = url.pathname === "/sse" || url.pathname === "/mcp";

			// Routing Decision:
			// MCP endpoint + MCP token → Direct to Agent SDK (bypass OAuth)
			// Everything else → Through OAuth Provider
			if (isMcpEndpoint && hasMcpToken(request)) {
				// MCP Token Route: Bypass OAuth Provider
				// - Inject MCP token into ctx.props
				// - Call Agent SDK handler directly
				// - Agent validates token in init()
				return handleMcpTokenRoute(request, env, ctx, url.pathname);
			}

			// OAuth Route: Use OAuth Provider
			// This handles:
			// - OAuth flow endpoints (/authorize, /token, /register, /.well-known/*)
			// - MCP endpoints with OAuth credentials (no MCP token)
			// - Health check and static routes (via defaultHandler)
			return handleOAuthRoute(request, env, ctx, oauthProvider);
		},
	};
}
