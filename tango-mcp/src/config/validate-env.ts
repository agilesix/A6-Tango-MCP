/**
 * Environment Configuration Validation
 *
 * Validates environment configuration at startup to catch configuration errors
 * early and provide clear error messages for misconfiguration.
 *
 * Validation Types:
 * - ERRORS: Critical issues that prevent server startup (missing TANGO_API_KEY, invalid KV, etc.)
 * - WARNINGS: Non-critical issues that should be addressed but don't block startup
 */

import type { Env } from "../types/env.js";

/**
 * Result of environment validation
 */
export interface ValidationResult {
	/** Whether the configuration is valid (no errors) */
	valid: boolean;
	/** Critical errors that prevent server startup */
	errors: string[];
	/** Non-critical warnings that should be addressed */
	warnings: string[];
}

/**
 * Validates environment configuration at startup
 *
 * This function performs comprehensive validation of all environment variables
 * and KV namespaces required for the Gateway Model to function correctly.
 *
 * @param env - The Cloudflare Workers environment bindings
 * @returns ValidationResult with errors and warnings
 */
export function validateEnvironment(env: Env): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// ==========================================
	// CRITICAL: TANGO API KEY
	// ==========================================
	if (!env.TANGO_API_KEY) {
		errors.push(
			"TANGO_API_KEY is REQUIRED for Gateway Model. " +
				"This is the centralized API key used for all Tango API calls. " +
				"Set via: wrangler secret put TANGO_API_KEY",
		);
	} else if (env.TANGO_API_KEY.length < 20) {
		warnings.push(
			"TANGO_API_KEY seems unusually short (< 20 chars). " +
				"Verify it's a valid Tango API key.",
		);
	}

	// ==========================================
	// KV NAMESPACES
	// ==========================================
	if (!env.TANGO_CACHE) {
		errors.push(
			"TANGO_CACHE KV namespace is required for response caching. " +
				"Configure in wrangler.jsonc: [[kv_namespaces]] with binding 'TANGO_CACHE'",
		);
	}

	if (!env.OAUTH_KV) {
		errors.push(
			"OAUTH_KV KV namespace is required for OAuth state and MCP token storage. " +
				"Configure in wrangler.jsonc: [[kv_namespaces]] with binding 'OAUTH_KV'",
		);
	}

	// ==========================================
	// OAUTH CONFIGURATION
	// ==========================================
	const hasOAuthClientId = !!env.GOOGLE_CLIENT_ID;
	const hasOAuthClientSecret = !!env.GOOGLE_CLIENT_SECRET;
	const hasCookieKey = !!env.COOKIE_ENCRYPTION_KEY;

	// Check for partial OAuth configuration
	const oauthFieldsConfigured = [
		hasOAuthClientId,
		hasOAuthClientSecret,
		hasCookieKey,
	].filter(Boolean).length;

	if (oauthFieldsConfigured > 0 && oauthFieldsConfigured < 3) {
		// Partial OAuth config - require all OAuth fields
		if (!hasOAuthClientId) {
			errors.push(
				"GOOGLE_CLIENT_ID is required when OAuth is configured. " +
					"Obtain from: https://console.cloud.google.com/apis/credentials",
			);
		}
		if (!hasOAuthClientSecret) {
			errors.push(
				"GOOGLE_CLIENT_SECRET is required when OAuth is configured. " +
					"Set via: wrangler secret put GOOGLE_CLIENT_SECRET",
			);
		}
		if (!hasCookieKey) {
			errors.push(
				"COOKIE_ENCRYPTION_KEY is required when OAuth is configured. " +
					"Generate with: openssl rand -base64 32, then set via: wrangler secret put COOKIE_ENCRYPTION_KEY",
			);
		}
	}

	// Validate cookie key length if present
	if (hasCookieKey && env.COOKIE_ENCRYPTION_KEY!.length < 32) {
		errors.push(
			"COOKIE_ENCRYPTION_KEY must be at least 32 characters for security. " +
				"Generate a secure key with: openssl rand -base64 32",
		);
	}

	// ==========================================
	// AUTHENTICATION ENFORCEMENT
	// ==========================================
	const requireAuth = env.REQUIRE_AUTHENTICATION !== "false";

	if (!requireAuth) {
		warnings.push(
			"REQUIRE_AUTHENTICATION is disabled - ANY client can access the server without authentication! " +
				"This should ONLY be false in local development. " +
				"Set to 'true' in production to enforce Gateway Model security.",
		);
	}

	if (requireAuth && !hasOAuthClientId) {
		warnings.push(
			"Authentication is required but OAuth is not configured. " +
				"Users won't be able to authenticate via Claude Code/Web. " +
				"Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and COOKIE_ENCRYPTION_KEY to enable OAuth.",
		);
	}

	// ==========================================
	// DOMAIN RESTRICTION
	// ==========================================
	if (hasOAuthClientId && !env.HOSTED_DOMAIN) {
		warnings.push(
			"HOSTED_DOMAIN is not set - OAuth will allow ANY Google account. " +
				"For Agile Six deployments, set to 'agile6.com' to restrict to employees only.",
		);
	}

	// ==========================================
	// MCP TOKEN CONFIGURATION
	// ==========================================
	if (env.MCP_TOKEN_EXPIRY_DAYS) {
		const days = Number.parseInt(env.MCP_TOKEN_EXPIRY_DAYS, 10);
		if (Number.isNaN(days) || days < 1) {
			errors.push(
				"MCP_TOKEN_EXPIRY_DAYS must be a positive integer (number of days). " +
					`Got: '${env.MCP_TOKEN_EXPIRY_DAYS}'`,
			);
		} else if (days > 730) {
			warnings.push(
				`MCP_TOKEN_EXPIRY_DAYS is set to ${days} days (> 2 years). ` +
					"Consider shorter expiry for better security (recommended: 365 days or less).",
			);
		}
	}

	if (env.ADMIN_EMAILS) {
		const emails = env.ADMIN_EMAILS.split(",").map((e) => e.trim());
		const invalidEmails = emails.filter(
			(email) => !email.includes("@") || !email.includes("."),
		);

		if (invalidEmails.length > 0) {
			warnings.push(
				`ADMIN_EMAILS contains invalid email format(s): ${invalidEmails.join(", ")}. ` +
					"Expected format: 'email1@example.com,email2@example.com'",
			);
		}

		// Check if hosted domain restriction is set but admin emails don't match
		if (env.HOSTED_DOMAIN) {
			const mismatchedEmails = emails.filter(
				(email) => !email.endsWith(`@${env.HOSTED_DOMAIN}`),
			);

			if (mismatchedEmails.length > 0) {
				warnings.push(
					`ADMIN_EMAILS contains addresses not matching HOSTED_DOMAIN '${env.HOSTED_DOMAIN}': ${mismatchedEmails.join(", ")}. ` +
						"These admins won't be able to authenticate via OAuth.",
				);
			}
		}
	}

	// ==========================================
	// ALLOWED AUTH METHODS
	// ==========================================
	if (env.ALLOWED_AUTH_METHODS) {
		const methods = env.ALLOWED_AUTH_METHODS.split(",").map((m) => m.trim());
		const validMethods = ["oauth", "mcp-token"];
		const invalidMethods = methods.filter((m) => !validMethods.includes(m));

		if (invalidMethods.length > 0) {
			errors.push(
				`ALLOWED_AUTH_METHODS contains invalid method(s): ${invalidMethods.join(", ")}. ` +
					"Valid methods: 'oauth', 'mcp-token'",
			);
		}
	}

	// ==========================================
	// NUMERIC CONFIGURATION VALUES
	// ==========================================

	// Validate CACHE_TTL_SECONDS
	if (env.CACHE_TTL_SECONDS) {
		const ttl = Number.parseInt(env.CACHE_TTL_SECONDS, 10);
		if (Number.isNaN(ttl) || ttl < 0) {
			errors.push(
				"CACHE_TTL_SECONDS must be a non-negative integer (seconds). " +
					`Got: '${env.CACHE_TTL_SECONDS}'`,
			);
		} else if (ttl > 3600) {
			warnings.push(
				`CACHE_TTL_SECONDS is set to ${ttl} seconds (> 1 hour). ` +
					"Long cache TTL may serve stale data. Consider shorter TTL (300-600 seconds).",
			);
		}
	}

	// Validate OAUTH_TOKEN_TTL_SECONDS
	if (env.OAUTH_TOKEN_TTL_SECONDS) {
		const ttl = Number.parseInt(env.OAUTH_TOKEN_TTL_SECONDS, 10);
		if (Number.isNaN(ttl) || ttl < 1) {
			errors.push(
				"OAUTH_TOKEN_TTL_SECONDS must be a positive integer (seconds). " +
					`Got: '${env.OAUTH_TOKEN_TTL_SECONDS}'`,
			);
		} else if (ttl < 300) {
			warnings.push(
				`OAUTH_TOKEN_TTL_SECONDS is set to ${ttl} seconds (< 5 minutes). ` +
					"Very short TTL may cause OAuth flow failures. Recommended: 600 seconds (10 minutes).",
			);
		}
	}

	// Validate SESSION_COOKIE_MAX_AGE
	if (env.SESSION_COOKIE_MAX_AGE) {
		const maxAge = Number.parseInt(env.SESSION_COOKIE_MAX_AGE, 10);
		if (Number.isNaN(maxAge) || maxAge < 1) {
			errors.push(
				"SESSION_COOKIE_MAX_AGE must be a positive integer (seconds). " +
					`Got: '${env.SESSION_COOKIE_MAX_AGE}'`,
			);
		}
	}

	// Validate RATE_LIMIT_PER_USER
	if (env.RATE_LIMIT_PER_USER) {
		const limit = Number.parseInt(env.RATE_LIMIT_PER_USER, 10);
		if (Number.isNaN(limit) || limit < 1) {
			errors.push(
				"RATE_LIMIT_PER_USER must be a positive integer (requests per hour). " +
					`Got: '${env.RATE_LIMIT_PER_USER}'`,
			);
		}
	}

	// ==========================================
	// BOOLEAN CONFIGURATION VALUES
	// ==========================================

	// Validate boolean flags (should be "true" or "false")
	const booleanFlags = [
		"REQUIRE_AUTHENTICATION",
		"ENABLE_AUTH_LOGGING",
		"ENABLE_TOKEN_ANALYTICS",
	] as const;

	for (const flag of booleanFlags) {
		const value = env[flag];
		if (
			value !== undefined &&
			value !== "true" &&
			value !== "false" &&
			value !== ""
		) {
			warnings.push(
				`${flag} should be "true" or "false" (got: '${value}'). ` +
					"Will be treated as truthy/falsy.",
			);
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Initialize environment with validation
 *
 * Call this function at server startup to validate configuration.
 * Logs warnings to console and throws error if configuration is invalid.
 *
 * @param env - The Cloudflare Workers environment bindings
 * @throws Error if configuration is invalid (has errors)
 */
export function initializeEnvironment(env: Env): void {
	const validation = validateEnvironment(env);

	// Log warnings (non-blocking)
	if (validation.warnings.length > 0) {
		console.warn("⚠️  Environment Configuration Warnings:");
		for (const warning of validation.warnings) {
			console.warn(`  - ${warning}`);
		}
		console.warn("");
	}

	// Throw if invalid (blocking)
	if (!validation.valid) {
		console.error("❌ Environment Configuration Errors:");
		for (const error of validation.errors) {
			console.error(`  - ${error}`);
		}
		console.error("");
		throw new Error(
			"Invalid environment configuration. Fix the errors above and redeploy.",
		);
	}

	console.log("✅ Environment configuration validated successfully");
}
