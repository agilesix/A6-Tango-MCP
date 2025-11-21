/**
 * MCP Header Extraction Middleware
 *
 * Extracts the x-mcp-access-token header from incoming requests
 * and injects it into ExecutionContext.props before passing to handlers.
 *
 * This enables MCP token authentication to work alongside OAuth.
 *
 * @module middleware/mcp-header-extractor
 */

/**
 * Extended ExecutionContext that includes props injection
 *
 * Note: This is not officially part of the ExecutionContext API,
 * but is used by OAuthProvider and Agent SDK for prop injection.
 *
 * We use an interface that doesn't extend ExecutionContext to avoid
 * TypeScript conflicts, but we cast to this type when needed.
 */
export interface MutableExecutionContext {
	/**
	 * Application-specific properties injected by middleware
	 * These are passed to Agent instances and apiHandlers
	 */
	props?: Record<string, unknown>;

	// Preserve ExecutionContext methods
	waitUntil(promise: Promise<unknown>): void;
	passThroughOnException(): void;
}

/**
 * Wraps a Worker handler to extract MCP authentication headers
 * and inject them into the execution context props.
 *
 * This middleware runs before OAuthProvider processes the request,
 * ensuring that both OAuth props (name, email, accessToken) and
 * MCP token props (mcpAccessToken) are available to downstream handlers.
 *
 * Flow:
 * 1. Extract x-mcp-access-token from request headers
 * 2. Initialize ctx.props if not already present
 * 3. Inject mcpAccessToken into props (if header present)
 * 4. Pass control to wrapped handler (OAuthProvider)
 * 5. OAuthProvider adds OAuth props to same ctx.props object
 * 6. Agent receives unified props with both auth methods
 *
 * @param handler - The base handler (typically OAuthProvider)
 * @returns Wrapped handler with MCP header extraction
 *
 * @example
 * ```typescript
 * const oauthProvider = new OAuthProvider({ ... });
 * export default withMcpHeaderExtraction(oauthProvider);
 * ```
 */
export function withMcpHeaderExtraction<Env = unknown>(
	handler: ExportedHandler<Env>
): ExportedHandler<Env> {
	return {
		async fetch(
			request: Request,
			env: Env,
			ctx: ExecutionContext
		): Promise<Response> {
			// Extract MCP access token from custom header
			// Headers are case-insensitive, so this works for any case variation
			const mcpToken = request.headers.get('x-mcp-access-token');

			// Cast ExecutionContext to allow props injection
			// This is a pragmatic approach used by OAuthProvider and Agent SDK
			// TypeScript doesn't officially support props, but it works in Cloudflare Workers
			// We use 'any' here as an intentional bypass of type safety for this known pattern
			const mutableCtx = ctx as any as MutableExecutionContext;

			// Initialize props if not already present
			// OAuthProvider may have already initialized this, so we preserve existing props
			if (!mutableCtx.props) {
				mutableCtx.props = {};
			}

			// Inject MCP token into props (if present)
			if (mcpToken) {
				mutableCtx.props.mcpAccessToken = mcpToken;
				console.log('[MCP Middleware] Extracted MCP token from header');
			}

			// Pass to the wrapped handler (OAuthProvider)
			// The props are now available to all downstream handlers
			// Check if handler.fetch exists before calling (it's required by ExportedHandler)
			if (!handler.fetch) {
				throw new Error('Handler must implement fetch method');
			}
			// TypeScript has issues with Request type compatibility between Workers types
			// This is a known issue with Cloudflare Workers type definitions
			// We use 'as any' to bypass this type mismatch
			return handler.fetch(request as any, env, ctx);
		}
	};
}
