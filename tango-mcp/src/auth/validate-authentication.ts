/**
 * Authentication Validation Module
 *
 * Implements Gateway Model authentication enforcement:
 * EVERY request must be authenticated (OAuth OR MCP token)
 */

import type { MCPProps } from "../index.js";
import type { Env } from "../types/env.js";
import { verifyMcpAccessToken } from "./mcp-token.js";

/**
 * Result of authentication validation
 */
export interface AuthValidationResult {
	/** Authentication was successful */
	authenticated: true;
	/** Authentication method used */
	method: "oauth" | "mcp-token";
	/** User information */
	user: {
		/** User email (OAuth only) */
		email?: string;
		/** User name (OAuth only) */
		name?: string;
		/** MCP token ID for logging (MCP token only) */
		tokenId?: string;
	};
}

/**
 * Validates that request has valid authentication
 *
 * Gateway Model enforcement:
 * 1. Check OAuth first (accessToken + email ending with @agile6.com)
 * 2. Check MCP token second (mcpAccessToken with full validation)
 * 3. Throw clear error if no valid authentication found
 *
 * @param props - MCP props containing authentication data
 * @param env - Environment bindings (required for token validation)
 * @returns AuthValidationResult with user info
 * @throws Error if authentication is invalid or missing
 */
export async function validateAuthentication(
	props?: MCPProps,
	env?: Env,
): Promise<AuthValidationResult> {
	// Check OAuth authentication first
	if (props?.accessToken) {
		// Validate email is present
		if (!props.email) {
			throw new Error(
				"Unauthorized: OAuth authentication requires email. Please re-authenticate.",
			);
		}

		// Validate email domain (case-insensitive)
		const emailLower = props.email.toLowerCase();
		if (!emailLower.endsWith("@agile6.com")) {
			throw new Error(
				`Unauthorized: Only @agile6.com accounts are allowed. Your account: ${props.email}`,
			);
		}

		// OAuth authentication successful
		return {
			authenticated: true,
			method: "oauth",
			user: {
				email: props.email,
				name: props.name,
			},
		};
	}

	// Check MCP access token
	if (props?.mcpAccessToken && env) {
		// Validate the token using the full verification system
		const validation = await verifyMcpAccessToken(props.mcpAccessToken, env, "unknown");

		if (!validation.valid) {
			// Provide specific error message based on reason
			const errorMessages = {
				malformed: "Invalid token format. Expected format: mcp_v1_...",
				not_found: "Token not found. It may have been deleted.",
				revoked: "Token has been revoked and is no longer valid.",
				invalid: "Token validation failed.",
			};

			const errorMessage =
				errorMessages[validation.reason || "invalid"] || "Token validation failed.";
			throw new Error(`Unauthorized: ${errorMessage}`);
		}

		// Token is valid
		return {
			authenticated: true,
			method: "mcp-token",
			user: {
				tokenId: validation.tokenId || "unknown",
			},
		};
	}

	// No valid authentication found
	throw new Error(
		"Unauthorized: Authentication required. " +
			"Use OAuth (Google) or provide x-mcp-access-token header. " +
			"OAuth users must have @agile6.com email addresses.",
	);
}

/**
 * Get user identifier string for logging
 * @param result - Authentication validation result
 * @returns Human-readable user identifier
 */
export function getUserIdentifierFromAuth(result: AuthValidationResult): string {
	if (result.method === "oauth") {
		return result.user.name || result.user.email || "OAuth User";
	}
	return `MCP Token (${result.user.tokenId})`;
}
