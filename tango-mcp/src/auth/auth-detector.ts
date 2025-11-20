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
 * Detect which authentication method is available
 * @param props - MCP props containing user-specific auth data
 * @param env - Environment variables with fallback API key
 * @returns AuthInfo with detected method and credentials
 */
export function detectAuthMethod(
	props?: MCPProps,
	env?: Record<string, unknown> | { TANGO_API_KEY?: string },
): AuthInfo {
	const hasOAuth = !!(props?.accessToken);
	const envApiKey =
		env && typeof env === "object" && "TANGO_API_KEY" in env
			? (env.TANGO_API_KEY as string | undefined)
			: undefined;
	const hasApiKey = !!(props?.tangoApiKey || envApiKey);

	let method: "api-key" | "oauth" | "none" = "none";

	// Priority: OAuth > API Key
	if (hasOAuth) {
		method = "oauth";
	} else if (hasApiKey) {
		method = "api-key";
	}

	return {
		method,
		hasApiKey,
		hasOAuth,
		apiKey: props?.tangoApiKey || envApiKey,
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
 * NOTE: Google OAuth is used to authenticate the USER to the MCP server,
 * but we always use the Tango API key for making API calls to Tango's backend.
 */
export function getAuthToken(authInfo: AuthInfo): string | undefined {
	// Always use Tango API key for API calls (from env or props)
	// OAuth is only for user authentication to the MCP server
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
