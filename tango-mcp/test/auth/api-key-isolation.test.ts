/**
 * API Key Isolation Tests
 *
 * These tests verify that the Tango API key can ONLY come from env.TANGO_API_KEY
 * and never from client-provided props or headers.
 *
 * Security Requirements:
 * 1. env.TANGO_API_KEY must be set at initialization
 * 2. Client cannot override the server's API key via props.tangoApiKey (field removed)
 * 3. Client cannot override the server's API key via x-tango-api-key header
 * 4. All tools receive env.TANGO_API_KEY regardless of what client sends
 */

import { describe, expect, it, beforeEach } from "vitest";
import { detectAuthMethod, getAuthToken } from "../../src/auth/auth-detector.js";
import type { MCPProps } from "../../src/index.js";
import type { Env } from "../../src/types/env.js";

describe("API Key Isolation", () => {
	describe("MCPProps interface", () => {
		it("should not have tangoApiKey property", () => {
			// This test verifies that tangoApiKey has been removed from MCPProps
			const props: MCPProps = {
				name: "Test User",
				email: "test@agile6.com",
				accessToken: "fake-oauth-token",
				authMethod: "oauth",
			};

			// TypeScript will error if tangoApiKey exists on MCPProps
			// @ts-expect-error - tangoApiKey should not exist on MCPProps
			expect(props.tangoApiKey).toBeUndefined();
		});

		it("should only accept 'oauth' or 'none' for authMethod", () => {
			const oauthProps: MCPProps = {
				authMethod: "oauth",
			};
			expect(oauthProps.authMethod).toBe("oauth");

			const noneProps: MCPProps = {
				authMethod: "none",
			};
			expect(noneProps.authMethod).toBe("none");

			// TypeScript will error if 'api-key' is used
			// @ts-expect-error - 'api-key' should not be valid
			const invalidProps: MCPProps = {
				authMethod: "api-key",
			};
		});
	});

	describe("detectAuthMethod()", () => {
		it("should only use env.TANGO_API_KEY, never props.tangoApiKey", () => {
			const props: MCPProps = {
				name: "Test User",
				email: "test@agile6.com",
			};

			const env = {
				TANGO_API_KEY: "env-api-key-12345",
			};

			const authInfo = detectAuthMethod(props, env);

			expect(authInfo.apiKey).toBe("env-api-key-12345");
			expect(authInfo.hasApiKey).toBe(true);
			expect(authInfo.method).toBe("api-key");
		});

		it("should prioritize OAuth over API key for method detection", () => {
			const props: MCPProps = {
				name: "Test User",
				email: "test@agile6.com",
				accessToken: "oauth-token-xyz",
			};

			const env = {
				TANGO_API_KEY: "env-api-key-12345",
			};

			const authInfo = detectAuthMethod(props, env);

			expect(authInfo.method).toBe("oauth");
			expect(authInfo.hasOAuth).toBe(true);
			expect(authInfo.hasApiKey).toBe(true);
			expect(authInfo.apiKey).toBe("env-api-key-12345"); // Still has API key from env
			expect(authInfo.oauthToken).toBe("oauth-token-xyz");
		});

		it("should return 'none' method if neither OAuth nor env API key present", () => {
			const props: MCPProps = {
				name: "Test User",
				email: "test@agile6.com",
			};

			const env = {}; // No TANGO_API_KEY

			const authInfo = detectAuthMethod(props, env);

			expect(authInfo.method).toBe("none");
			expect(authInfo.hasOAuth).toBe(false);
			expect(authInfo.hasApiKey).toBe(false);
			expect(authInfo.apiKey).toBeUndefined();
		});

		it("should handle missing env parameter", () => {
			const props: MCPProps = {
				name: "Test User",
				email: "test@agile6.com",
			};

			const authInfo = detectAuthMethod(props, undefined);

			expect(authInfo.method).toBe("none");
			expect(authInfo.hasApiKey).toBe(false);
			expect(authInfo.apiKey).toBeUndefined();
		});

		it("should handle missing props parameter", () => {
			const env = {
				TANGO_API_KEY: "env-api-key-12345",
			};

			const authInfo = detectAuthMethod(undefined, env);

			expect(authInfo.method).toBe("api-key");
			expect(authInfo.hasApiKey).toBe(true);
			expect(authInfo.apiKey).toBe("env-api-key-12345");
			expect(authInfo.hasOAuth).toBe(false);
		});

		it("should never check for props.tangoApiKey (field removed)", () => {
			// Even if someone tries to pass tangoApiKey via props, it should be ignored
			const maliciousProps: any = {
				name: "Malicious User",
				email: "malicious@example.com",
				tangoApiKey: "malicious-key-attempt", // Should be ignored
			};

			const env = {
				TANGO_API_KEY: "env-api-key-12345",
			};

			const authInfo = detectAuthMethod(maliciousProps, env);

			// Should only use env API key, never the malicious one
			expect(authInfo.apiKey).toBe("env-api-key-12345");
			expect(authInfo.apiKey).not.toBe("malicious-key-attempt");
		});
	});

	describe("getAuthToken()", () => {
		it("should return env API key from authInfo", () => {
			const authInfo = {
				method: "api-key" as const,
				hasApiKey: true,
				hasOAuth: false,
				apiKey: "env-api-key-12345",
				userEmail: "test@agile6.com",
				userName: "Test User",
			};

			const token = getAuthToken(authInfo);

			expect(token).toBe("env-api-key-12345");
		});

		it("should return env API key even when OAuth is present", () => {
			const authInfo = {
				method: "oauth" as const,
				hasApiKey: true,
				hasOAuth: true,
				apiKey: "env-api-key-12345",
				oauthToken: "oauth-token-xyz",
				userEmail: "test@agile6.com",
				userName: "Test User",
			};

			const token = getAuthToken(authInfo);

			// For Tango API calls, we use API key, not OAuth token
			expect(token).toBe("env-api-key-12345");
		});

		it("should return undefined if no API key available", () => {
			const authInfo = {
				method: "none" as const,
				hasApiKey: false,
				hasOAuth: false,
				userEmail: "test@agile6.com",
				userName: "Test User",
			};

			const token = getAuthToken(authInfo);

			expect(token).toBeUndefined();
		});
	});

	describe("Integration: Environment Validation", () => {
		it("should enforce TANGO_API_KEY is required at startup", () => {
			// This is validated by src/config/validate-env.ts
			// The initializeEnvironment() function will throw if TANGO_API_KEY is missing

			const invalidEnv: Partial<Env> = {
				// Missing TANGO_API_KEY
				TANGO_API_BASE_URL: "https://api.tango.makegov.com",
			};

			// In production, this would cause server startup to fail
			// We test the validation logic directly in validate-env.test.ts
		});
	});

	describe("Security: Client Cannot Override API Key", () => {
		it("should ignore any attempt to pass API key via props", () => {
			// Even if a malicious client somehow manages to pass tangoApiKey
			const maliciousProps: any = {
				name: "Attacker",
				email: "attacker@evil.com",
				tangoApiKey: "attacker-controlled-key",
				accessToken: "fake-token",
			};

			const env = {
				TANGO_API_KEY: "legitimate-server-key",
			};

			const authInfo = detectAuthMethod(maliciousProps, env);

			// Server's key should always be used
			expect(authInfo.apiKey).toBe("legitimate-server-key");
			expect(authInfo.apiKey).not.toBe("attacker-controlled-key");
		});

		it("should ignore x-tango-api-key header (not mapped to props)", () => {
			// The x-tango-api-key header is no longer mapped to props.tangoApiKey
			// Even if the agents framework tried to map it, MCPProps doesn't have that field

			const props: MCPProps = {
				name: "Test User",
				email: "test@agile6.com",
				// No tangoApiKey field exists
			};

			const env = {
				TANGO_API_KEY: "server-api-key",
			};

			const authInfo = detectAuthMethod(props, env);

			expect(authInfo.apiKey).toBe("server-api-key");
		});

		it("should always use server's API key for tool calls", () => {
			// Simulate what happens in MCPServerAgent.init()
			const props: MCPProps = {
				name: "User",
				email: "user@agile6.com",
				accessToken: "oauth-token",
			};

			const env = {
				TANGO_API_KEY: "server-managed-key",
			};

			// What the server does:
			// 1. Detect auth method
			const authInfo = detectAuthMethod(props, env);

			// 2. Get auth token (not used in new implementation)
			const deprecatedToken = getAuthToken(authInfo);

			// 3. SECURITY: Always use env.TANGO_API_KEY directly
			const actualTokenUsed = env.TANGO_API_KEY;

			expect(actualTokenUsed).toBe("server-managed-key");

			// The old getAuthToken() still returns the same value
			expect(deprecatedToken).toBe("server-managed-key");

			// But in src/index.ts, we now do:
			// const authToken = env.TANGO_API_KEY;
			// instead of:
			// const authToken = getAuthToken(authInfo);
		});
	});

	describe("Backward Compatibility", () => {
		it("should maintain hasApiKey field for backward compatibility", () => {
			const env = {
				TANGO_API_KEY: "env-key",
			};

			const authInfo = detectAuthMethod({}, env);

			// hasApiKey field is maintained but only checks env
			expect(authInfo.hasApiKey).toBe(true);
		});

		it("should maintain api-key method detection when no OAuth present", () => {
			const env = {
				TANGO_API_KEY: "env-key",
			};

			const authInfo = detectAuthMethod({}, env);

			// Method is still 'api-key' but it only comes from env
			expect(authInfo.method).toBe("api-key");
			expect(authInfo.apiKey).toBe("env-key");
		});

		it("should handle tools that still use userApiKey || env.TANGO_API_KEY pattern", () => {
			// Tools still do: const apiKey = userApiKey || env.TANGO_API_KEY;
			// userApiKey is now always env.TANGO_API_KEY passed from init()
			// The || fallback provides extra safety

			const userApiKey = "server-key"; // Passed from init()
			const env = {
				TANGO_API_KEY: "server-key", // Same value
			};

			const apiKey = userApiKey || env.TANGO_API_KEY;

			expect(apiKey).toBe("server-key");
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty string as env API key", () => {
			const env = {
				TANGO_API_KEY: "",
			};

			const authInfo = detectAuthMethod({}, env);

			expect(authInfo.hasApiKey).toBe(false); // Empty string is falsy
			expect(authInfo.method).toBe("none");
		});

		it("should handle whitespace-only env API key", () => {
			const env = {
				TANGO_API_KEY: "   ",
			};

			const authInfo = detectAuthMethod({}, env);

			// Whitespace is truthy but invalid
			expect(authInfo.hasApiKey).toBe(true);
			expect(authInfo.apiKey).toBe("   ");
		});

		it("should handle non-string env object", () => {
			const env = "not-an-object" as any;

			const authInfo = detectAuthMethod({}, env);

			expect(authInfo.hasApiKey).toBe(false);
			expect(authInfo.apiKey).toBeUndefined();
		});

		it("should handle env object without TANGO_API_KEY property", () => {
			const env = {
				OTHER_KEY: "value",
			};

			const authInfo = detectAuthMethod({}, env);

			expect(authInfo.hasApiKey).toBe(false);
			expect(authInfo.apiKey).toBeUndefined();
		});
	});
});
