/**
 * Unit Tests for Environment Configuration Validation
 *
 * Tests the validateEnvironment function to ensure it properly validates
 * all environment configuration for the Gateway Model.
 */

import { describe, it, expect } from "vitest";
import { validateEnvironment, initializeEnvironment } from "../../src/config/validate-env.js";
import type { Env } from "../../src/types/env.js";

/**
 * Helper function to create a minimal valid Env object
 */
function createValidEnv(): Env {
	return {
		TANGO_API_KEY: "valid_tango_api_key_with_sufficient_length",
		TANGO_CACHE: {} as KVNamespace,
		OAUTH_KV: {} as KVNamespace,
		GOOGLE_CLIENT_ID: "123456789.apps.googleusercontent.com",
		GOOGLE_CLIENT_SECRET: "GOCSPX-test-secret",
		COOKIE_ENCRYPTION_KEY: "this_is_a_valid_32_character_key_for_testing",
		HOSTED_DOMAIN: "agile6.com",
	};
}

describe("validateEnvironment", () => {
	describe("TANGO_API_KEY validation", () => {
		it("should error if TANGO_API_KEY is missing", () => {
			const env = createValidEnv();
			delete (env as any).TANGO_API_KEY;

			const result = validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain("TANGO_API_KEY is REQUIRED");
		});

		it("should warn if TANGO_API_KEY is too short", () => {
			const env = createValidEnv();
			env.TANGO_API_KEY = "short";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(true); // Warning, not error
			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0]).toContain("unusually short");
		});

		it("should pass with valid TANGO_API_KEY", () => {
			const env = createValidEnv();

			const result = validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe("KV Namespace validation", () => {
		it("should error if TANGO_CACHE is missing", () => {
			const env = createValidEnv();
			delete (env as any).TANGO_CACHE;

			const result = validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("TANGO_CACHE"))).toBe(true);
		});

		it("should error if OAUTH_KV is missing", () => {
			const env = createValidEnv();
			delete (env as any).OAUTH_KV;

			const result = validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("OAUTH_KV"))).toBe(true);
		});
	});

	describe("OAuth configuration validation", () => {
		it("should error if OAuth is partially configured (missing CLIENT_ID)", () => {
			const env = createValidEnv();
			delete (env as any).GOOGLE_CLIENT_ID;

			const result = validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("GOOGLE_CLIENT_ID"))).toBe(true);
		});

		it("should error if OAuth is partially configured (missing CLIENT_SECRET)", () => {
			const env = createValidEnv();
			delete (env as any).GOOGLE_CLIENT_SECRET;

			const result = validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("GOOGLE_CLIENT_SECRET"))).toBe(true);
		});

		it("should error if OAuth is partially configured (missing COOKIE_ENCRYPTION_KEY)", () => {
			const env = createValidEnv();
			delete (env as any).COOKIE_ENCRYPTION_KEY;

			const result = validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("COOKIE_ENCRYPTION_KEY"))).toBe(true);
		});

		it("should error if COOKIE_ENCRYPTION_KEY is too short", () => {
			const env = createValidEnv();
			env.COOKIE_ENCRYPTION_KEY = "too_short";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("at least 32 characters"))).toBe(true);
		});

		it("should pass if OAuth is not configured at all", () => {
			const env = createValidEnv();
			delete (env as any).GOOGLE_CLIENT_ID;
			delete (env as any).GOOGLE_CLIENT_SECRET;
			delete (env as any).COOKIE_ENCRYPTION_KEY;

			const result = validateEnvironment(env);

			// Should pass but with warning about auth not configured
			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes("OAuth is not configured"))).toBe(true);
		});

		it("should warn if HOSTED_DOMAIN is not set with OAuth configured", () => {
			const env = createValidEnv();
			delete (env as any).HOSTED_DOMAIN;

			const result = validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes("HOSTED_DOMAIN"))).toBe(true);
		});
	});

	describe("Authentication configuration validation", () => {
		it("should warn if REQUIRE_AUTHENTICATION is false", () => {
			const env = createValidEnv();
			env.REQUIRE_AUTHENTICATION = "false";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes("REQUIRE_AUTHENTICATION is disabled"))).toBe(true);
		});

		it("should not warn if REQUIRE_AUTHENTICATION is true", () => {
			const env = createValidEnv();
			env.REQUIRE_AUTHENTICATION = "true";

			const result = validateEnvironment(env);

			expect(result.warnings.some((w) => w.includes("REQUIRE_AUTHENTICATION"))).toBe(false);
		});
	});

	describe("MCP Token configuration validation", () => {
		it("should error if MCP_TOKEN_EXPIRY_DAYS is not a number", () => {
			const env = createValidEnv();
			env.MCP_TOKEN_EXPIRY_DAYS = "not_a_number";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("MCP_TOKEN_EXPIRY_DAYS must be a positive integer"))).toBe(true);
		});

		it("should error if MCP_TOKEN_EXPIRY_DAYS is negative", () => {
			const env = createValidEnv();
			env.MCP_TOKEN_EXPIRY_DAYS = "-10";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("MCP_TOKEN_EXPIRY_DAYS must be a positive integer"))).toBe(true);
		});

		it("should warn if MCP_TOKEN_EXPIRY_DAYS is > 730 days", () => {
			const env = createValidEnv();
			env.MCP_TOKEN_EXPIRY_DAYS = "1000";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes("> 2 years"))).toBe(true);
		});

		it("should pass with valid MCP_TOKEN_EXPIRY_DAYS", () => {
			const env = createValidEnv();
			env.MCP_TOKEN_EXPIRY_DAYS = "365";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(true);
		});

		it("should warn if ADMIN_EMAILS contains invalid email format", () => {
			const env = createValidEnv();
			env.ADMIN_EMAILS = "valid@example.com,invalid-email,another@valid.com";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes("invalid email format"))).toBe(true);
		});

		it("should warn if ADMIN_EMAILS don't match HOSTED_DOMAIN", () => {
			const env = createValidEnv();
			env.ADMIN_EMAILS = "admin@otherdomain.com";
			env.HOSTED_DOMAIN = "agile6.com";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes("not matching HOSTED_DOMAIN"))).toBe(true);
		});

		it("should pass with valid ADMIN_EMAILS", () => {
			const env = createValidEnv();
			env.ADMIN_EMAILS = "admin@agile6.com,manager@agile6.com";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe("Numeric configuration validation", () => {
		it("should error if CACHE_TTL_SECONDS is not a number", () => {
			const env = createValidEnv();
			env.CACHE_TTL_SECONDS = "invalid";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("CACHE_TTL_SECONDS"))).toBe(true);
		});

		it("should warn if CACHE_TTL_SECONDS is > 3600", () => {
			const env = createValidEnv();
			env.CACHE_TTL_SECONDS = "7200";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes("stale data"))).toBe(true);
		});

		it("should error if OAUTH_TOKEN_TTL_SECONDS is invalid", () => {
			const env = createValidEnv();
			env.OAUTH_TOKEN_TTL_SECONDS = "0";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("OAUTH_TOKEN_TTL_SECONDS"))).toBe(true);
		});

		it("should warn if OAUTH_TOKEN_TTL_SECONDS is too short", () => {
			const env = createValidEnv();
			env.OAUTH_TOKEN_TTL_SECONDS = "60";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes("OAuth flow failures"))).toBe(true);
		});

		it("should error if RATE_LIMIT_PER_USER is invalid", () => {
			const env = createValidEnv();
			env.RATE_LIMIT_PER_USER = "-100";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("RATE_LIMIT_PER_USER"))).toBe(true);
		});
	});

	describe("ALLOWED_AUTH_METHODS validation", () => {
		it("should error if ALLOWED_AUTH_METHODS contains invalid methods", () => {
			const env = createValidEnv();
			env.ALLOWED_AUTH_METHODS = "oauth,invalid-method,mcp-token";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("invalid method"))).toBe(true);
		});

		it("should pass with valid ALLOWED_AUTH_METHODS", () => {
			const env = createValidEnv();
			env.ALLOWED_AUTH_METHODS = "oauth,mcp-token";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(true);
		});
	});

	describe("Complete valid configuration", () => {
		it("should pass with complete valid configuration", () => {
			const env = createValidEnv();

			const result = validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("should pass with valid optional configurations", () => {
			const env = createValidEnv();
			env.CACHE_TTL_SECONDS = "600";
			env.MCP_TOKEN_EXPIRY_DAYS = "365";
			env.ADMIN_EMAILS = "admin@agile6.com";
			env.REQUIRE_AUTHENTICATION = "true";
			env.ALLOWED_AUTH_METHODS = "oauth,mcp-token";

			const result = validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe("Multiple errors", () => {
		it("should collect all errors from invalid configuration", () => {
			const env = {
				// Missing TANGO_API_KEY
				// Missing TANGO_CACHE
				OAUTH_KV: {} as KVNamespace,
				GOOGLE_CLIENT_ID: "test",
				// Missing GOOGLE_CLIENT_SECRET (partial OAuth)
				// Missing COOKIE_ENCRYPTION_KEY (partial OAuth)
			} as Env;

			const result = validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(1);
			expect(result.errors.some((e) => e.includes("TANGO_API_KEY"))).toBe(true);
			expect(result.errors.some((e) => e.includes("TANGO_CACHE"))).toBe(true);
			expect(result.errors.some((e) => e.includes("GOOGLE_CLIENT_SECRET"))).toBe(true);
			expect(result.errors.some((e) => e.includes("COOKIE_ENCRYPTION_KEY"))).toBe(true);
		});
	});
});

describe("initializeEnvironment", () => {
	it("should not throw with valid configuration", () => {
		const env = createValidEnv();

		expect(() => initializeEnvironment(env)).not.toThrow();
	});

	it("should throw with invalid configuration", () => {
		const env = createValidEnv();
		delete (env as any).TANGO_API_KEY;

		expect(() => initializeEnvironment(env)).toThrow("Invalid environment configuration");
	});

	it("should include error details in thrown error", () => {
		const env = createValidEnv();
		delete (env as any).TANGO_API_KEY;

		try {
			initializeEnvironment(env);
			expect.fail("Should have thrown an error");
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toContain("Invalid environment configuration");
		}
	});
});
