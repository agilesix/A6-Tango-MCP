/**
 * Authentication Detection Utility
 *
 * Detects and manages dual authentication (OAuth + API Key) with backwards compatibility.
 * Priority: OAuth > API Key > None
 */

import type { MCPProps } from "../index.js";

export interface AuthInfo {
	/** Authentication method detected */
	method: "api-key" | "oauth" | "none";
	/** Whether API key is available */
	hasApiKey: boolean;
	/** Whether OAuth token is available */
	hasOAuth: boolean;
	/** API key (from header or env) */
	apiKey?: string;
	/** OAuth access token */
	oauthToken?: string;
	/** User email (from OAuth) */
	userEmail?: string;
	/** User name (from OAuth) */
	userName?: string;
}

/**
 * Detect which authentication method is available for USER authentication
 * @param props - MCP props containing user-specific auth data
 * @param env - Environment variables (API key is accessed directly in init(), not here)
 * @returns AuthInfo with detected method and credentials
 *
 * NOTE: This function only detects OAuth authentication for user identity.
 * The Tango API key always comes from env.TANGO_API_KEY and is NOT checked here.
 */
export function detectAuthMethod(
	props?: MCPProps,
	env?: Record<string, unknown> | { TANGO_API_KEY?: string },
): AuthInfo {
	const hasOAuth = !!(props?.accessToken);

	// SECURITY: env.TANGO_API_KEY is extracted for compatibility but NOT used for auth
	// The server ALWAYS uses env.TANGO_API_KEY directly, never from client props
	const envApiKey =
		env && typeof env === "object" && "TANGO_API_KEY" in env
			? (env.TANGO_API_KEY as string | undefined)
			: undefined;

	// API key presence is tracked for backward compatibility in hasApiKey field
	// but props.tangoApiKey is NEVER used (it no longer exists in MCPProps)
	const hasApiKey = !!envApiKey;

	let method: "api-key" | "oauth" | "none" = "none";

	// Only OAuth is considered for user authentication
	if (hasOAuth) {
		method = "oauth";
	} else if (hasApiKey) {
		// If no OAuth but API key exists, we still have API key auth
		method = "api-key";
	}

	return {
		method,
		hasApiKey,
		hasOAuth,
		apiKey: envApiKey, // SECURITY: Only env API key, never from props
		oauthToken: props?.accessToken,
		userEmail: props?.email,
		userName: props?.name,
	};
}

/**
 * Get the active authentication token for API calls
 * @param authInfo - Authentication info from detectAuthMethod()
 * @returns Token to use for Tango API authentication
 *
 * NOTE: This function is deprecated and should not be used.
 * The caller should use env.TANGO_API_KEY directly instead.
 *
 * Google OAuth is used to authenticate the USER to the MCP server,
 * but we always use env.TANGO_API_KEY for making API calls to Tango's backend.
 *
 * @deprecated Use env.TANGO_API_KEY directly instead of calling this function
 */
export function getAuthToken(authInfo: AuthInfo): string | undefined {
	// SECURITY: Always use Tango API key from environment
	// OAuth is only for user authentication to the MCP server
	// Client-provided API keys (via props) are NOT supported
	return authInfo.apiKey;
}

/**
 * Get user identifier for logging/debugging
 * @param authInfo - Authentication info
 * @returns User identifier string
 */
export function getUserIdentifier(authInfo: AuthInfo): string {
	if (authInfo.userName) {
		return authInfo.userName;
	}
	if (authInfo.userEmail) {
		return authInfo.userEmail;
	}
	if (authInfo.method === "api-key") {
		return "API Key User";
	}
	return "Anonymous";
}
