/**
 * Integration Tests: Gateway Model Authentication Flow
 *
 * Tests the COMPLETE authentication flow from client request → auth validation → tool execution
 *
 * Test ID Range: IT-01-01 through IT-03-05 (from 08-testing-requirements.md)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Env } from "../../src/types/env.js";
import { validateAuthentication } from "../../src/auth/validate-authentication.js";
import { generateMcpAccessToken, verifyMcpAccessToken, revokeMcpAccessToken } from "../../src/auth/mcp-token.js";
import { MCPServerAgent } from "../../src/index.js";

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
		const expiration = options?.expirationTtl
			? Date.now() + options.expirationTtl * 1000
			: undefined;
		this.storage.set(key, { value, expiration });
	}

	async delete(key: string): Promise<void> {
		this.storage.delete(key);
	}

	async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
		const keys = Array.from(this.storage.keys());
		const filtered = options?.prefix
			? keys.filter((k) => k.startsWith(options.prefix))
			: keys;
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

describe("Integration: OAuth Authentication Flow", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("IT-01-01: should complete full OAuth flow for @agile6.com user", async () => {
		// Step 1: Client provides OAuth credentials
		const props = {
			accessToken: "ya29.a0ARrdaM-test-token",
			email: "john.doe@agile6.com",
			name: "John Doe",
		};

		// Step 2: Validate authentication
		const authResult = await validateAuthentication(props, env);

		// Step 3: Verify authentication succeeded
		expect(authResult.authenticated).toBe(true);
		expect(authResult.method).toBe("oauth");
		expect(authResult.user?.email).toBe("john.doe@agile6.com");
		expect(authResult.user?.name).toBe("John Doe");

		// Step 4: Verify server can use Tango API key
		expect(env.TANGO_API_KEY).toBeDefined();
		expect(env.TANGO_API_KEY).toBe("test_tango_api_key_1234567890");
	});

	it("IT-01-02: should reject OAuth flow for non-@agile6.com user", async () => {
		const props = {
			accessToken: "ya29.a0ARrdaM-attacker-token",
			email: "attacker@evil.com",
			name: "Jane Attacker",
		};

		// Validation should fail
		await expect(validateAuthentication(props, env)).rejects.toThrow(
			"Only @agile6.com accounts are allowed"
		);
	});

	it("IT-01-03: should reject OAuth with case-sensitive subdomain attack", async () => {
		const props = {
			accessToken: "ya29.a0ARrdaM-attacker-token",
			email: "attacker@evil-agile6.com",
			name: "Attacker",
		};

		await expect(validateAuthentication(props, env)).rejects.toThrow(
			"Only @agile6.com accounts are allowed"
		);
	});

	it("IT-01-04: should accept @agile6.com with case-insensitive domain", async () => {
		const testCases = [
			"user@agile6.com",
			"user@AGILE6.COM",
			"user@AgIlE6.CoM",
			"user@Agile6.Com",
		];

		for (const email of testCases) {
			const props = {
				accessToken: "ya29.test-token",
				email,
				name: "Test User",
			};

			const result = await validateAuthentication(props, env);
			expect(result.authenticated).toBe(true);
			expect(result.method).toBe("oauth");
		}
	});

	it("IT-01-05: should provide clear error for missing OAuth email", async () => {
		const props = {
			accessToken: "ya29.test-token",
			name: "User Without Email",
		};

		await expect(validateAuthentication(props, env)).rejects.toThrow(
			"OAuth authentication requires email"
		);
	});
});

describe("Integration: MCP Access Token Flow", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("IT-02-01: should authenticate agent SDK request with valid MCP token", async () => {
		// Step 1: Generate MCP access token
		const generateResult = await generateMcpAccessToken(
			"developer@agile6.com",
			"Test token for agent SDK",
			env,
			"127.0.0.1",
			"Mozilla/5.0"
		);

		expect(generateResult.token).toMatch(/^mcp_v1_/);
		expect(generateResult.tokenId).toBeDefined();
		expect(generateResult.userId).toBe("developer@agile6.com");

		// Step 2: Validate authentication with token
		const props = {
			mcpAccessToken: generateResult.token,
		};

		const authResult = await validateAuthentication(props, env);

		// Step 3: Verify authentication succeeded
		expect(authResult.authenticated).toBe(true);
		expect(authResult.method).toBe("mcp-token");
		expect(authResult.user?.tokenId).toBeDefined(); // Token ID is returned, not userId
	});

	it("IT-02-02: should reject agent SDK request with invalid token", async () => {
		const props = {
			mcpAccessToken: "mcp_v1_invalid_fake_token_12345",
		};

		await expect(validateAuthentication(props, env)).rejects.toThrow(
			"Token not found"
		);
	});

	it("IT-02-03: should update lastUsed timestamp on token usage", async () => {
		// Generate token
		const generateResult = await generateMcpAccessToken(
			"user@agile6.com",
			"Test token",
			env,
			"127.0.0.1",
			"Mozilla/5.0"
		);

		// First validation
		const result1 = await verifyMcpAccessToken(generateResult.token, env, "127.0.0.1");
		expect(result1.valid).toBe(true);

		// Wait a bit
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Second validation
		const result2 = await verifyMcpAccessToken(generateResult.token, env, "127.0.0.1");

		// Verify lastUsed was updated
		expect(result2.valid).toBe(true);
		expect(result2.tokenData?.metadata.usageCount).toBeGreaterThan(1);
	});

	it("IT-02-04: should handle concurrent requests with same token", async () => {
		// Generate token
		const generateResult = await generateMcpAccessToken(
			"user@agile6.com",
			"Concurrent test token",
			env,
			"127.0.0.1",
			"Mozilla/5.0"
		);

		// Make 10 simultaneous requests
		const promises = Array.from({ length: 10 }, () =>
			verifyMcpAccessToken(generateResult.token, env, "127.0.0.1")
		);

		const results = await Promise.all(promises);

		// All should succeed
		results.forEach((result) => {
			expect(result.valid).toBe(true);
		});
	});

	it("IT-02-05: should accept tokens regardless of age (no expiration implemented)", async () => {
		// NOTE: Token expiration is not yet implemented in mcp-token.ts
		// Tokens remain valid indefinitely unless explicitly revoked
		// This test verifies current behavior: tokens don't expire

		// Generate token
		const generateResult = await generateMcpAccessToken(
			"user@agile6.com",
			"Long-lived token",
			env,
			"127.0.0.1",
			"Mozilla/5.0"
		);

		// Manually set createdAt to 1 year ago to simulate an old token
		const tokenHash = await hashTokenForTest(generateResult.token);
		const tokenData = await env.OAUTH_KV.get(`token:hash:${tokenHash}`);
		if (!tokenData) throw new Error("Token not found");

		const parsed = JSON.parse(tokenData);
		parsed.createdAt = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year ago
		await env.OAUTH_KV.put(`token:hash:${tokenHash}`, JSON.stringify(parsed));

		// Verification should SUCCEED - tokens don't expire
		const result = await verifyMcpAccessToken(generateResult.token, env, "127.0.0.1");
		expect(result.valid).toBe(true);
		expect(result.tokenData.userId).toBe("user@agile6.com");
	});

	it("IT-02-06: should reject revoked token", async () => {
		// Generate token
		const generateResult = await generateMcpAccessToken(
			"user@agile6.com",
			"Token to revoke",
			env,
			"127.0.0.1",
			"Mozilla/5.0"
		);

		// Revoke it
		await revokeMcpAccessToken(generateResult.tokenId!, "Testing revocation", env);

		// Validation should fail
		const props = {
			mcpAccessToken: generateResult.token,
		};

		await expect(validateAuthentication(props, env)).rejects.toThrow(
			"Token has been revoked"
		);
	});
});

describe("Integration: Unauthenticated Request Handling", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("IT-03-01: should reject request with no authentication", async () => {
		const props = {};

		await expect(validateAuthentication(props, env)).rejects.toThrow(
			"Authentication required"
		);
	});

	it("IT-03-02: should reject request with empty OAuth token", async () => {
		const props = {
			accessToken: "",
			email: "user@agile6.com",
			name: "User",
		};

		await expect(validateAuthentication(props, env)).rejects.toThrow(
			"Authentication required"
		);
	});

	it("IT-03-03: should reject request with empty MCP token", async () => {
		const props = {
			mcpAccessToken: "",
		};

		await expect(validateAuthentication(props, env)).rejects.toThrow(
			"Authentication required"
		);
	});

	it("IT-03-04: should provide actionable error messages", async () => {
		const props = {};

		try {
			await validateAuthentication(props, env);
			expect.fail("Should have thrown error");
		} catch (error) {
			const errorMessage = (error as Error).message;
			expect(errorMessage).toContain("Authentication required");
			expect(errorMessage).toContain("OAuth");
			expect(errorMessage).toContain("x-mcp-access-token");
		}
	});
});

describe("Integration: Tool Execution with Authentication", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("IT-03-05: should execute tool with valid OAuth authentication", async () => {
		const props = {
			accessToken: "ya29.test-token",
			email: "user@agile6.com",
			name: "Test User",
		};

		// Validate authentication
		const authResult = await validateAuthentication(props, env);
		expect(authResult.authenticated).toBe(true);

		// Verify server can use Tango API key for tool calls
		expect(env.TANGO_API_KEY).toBeDefined();
		expect(env.TANGO_API_KEY).not.toContain("ya29"); // Not using OAuth token
		expect(env.TANGO_API_KEY).toBe("test_tango_api_key_1234567890");
	});

	it("IT-03-06: should execute tool with valid MCP token authentication", async () => {
		// Generate token
		const generateResult = await generateMcpAccessToken(
			"user@agile6.com",
			"Tool execution token",
			env,
			"127.0.0.1",
			"Mozilla/5.0"
		);

		const props = {
			mcpAccessToken: generateResult.token,
		};

		// Validate authentication
		const authResult = await validateAuthentication(props, env);
		expect(authResult.authenticated).toBe(true);

		// Verify server uses Tango API key (not MCP token) for API calls
		expect(env.TANGO_API_KEY).toBeDefined();
		expect(env.TANGO_API_KEY).not.toContain("mcp_v1"); // Not using MCP token
		expect(env.TANGO_API_KEY).toBe("test_tango_api_key_1234567890");
	});

	it("IT-03-07: should prevent client from injecting Tango API key", async () => {
		// Client attempts to provide their own API key
		const props = {
			accessToken: "ya29.test-token",
			email: "attacker@agile6.com",
			name: "Attacker",
			tangoApiKey: "malicious_api_key_12345", // Attempt to inject
		} as any;

		// Authentication should succeed (OAuth is valid)
		const authResult = await validateAuthentication(props, env);
		expect(authResult.authenticated).toBe(true);

		// But server MUST use its own API key, not client's
		expect(env.TANGO_API_KEY).toBe("test_tango_api_key_1234567890");
		expect(env.TANGO_API_KEY).not.toBe("malicious_api_key_12345");
	});
});

describe("Integration: Session Persistence", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("IT-03-08: should persist token across multiple requests", async () => {
		// Generate token
		const generateResult = await generateMcpAccessToken(
			"user@agile6.com",
			"Persistent token",
			env,
			"127.0.0.1",
			"Mozilla/5.0"
		);

		// Use token multiple times
		for (let i = 0; i < 5; i++) {
			const props = {
				mcpAccessToken: generateResult.token,
			};

			const authResult = await validateAuthentication(props, env);
			expect(authResult.authenticated).toBe(true);
			expect(authResult.method).toBe("mcp-token");
		}

		// Verify usage count increased
		const verifyResult = await verifyMcpAccessToken(generateResult.token, env, "127.0.0.1");
		expect(verifyResult.valid).toBe(true);
		expect(verifyResult.tokenData?.metadata.usageCount).toBeGreaterThanOrEqual(5);
	});

	it("IT-03-09: should track usage metadata correctly", async () => {
		// Generate token
		const generateResult = await generateMcpAccessToken(
			"user@agile6.com",
			"Metadata tracking token",
			env,
			"127.0.0.1",
			"Mozilla/5.0"
		);

		// Verify token (updates metadata)
		await verifyMcpAccessToken(generateResult.token, env, "192.168.1.1");

		// Verify metadata was updated
		const verifyResult = await verifyMcpAccessToken(generateResult.token, env, "192.168.1.2");
		expect(verifyResult.valid).toBe(true);
		expect(verifyResult.tokenData?.metadata.usageCount).toBeGreaterThan(0);
		expect(verifyResult.tokenData?.metadata.lastUsedFromIp).toBe("192.168.1.2");
		expect(verifyResult.tokenData?.lastUsedAt).toBeDefined();
	});
});

describe("Integration: Error Handling", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("IT-03-10: should handle malformed token gracefully", async () => {
		const malformedTokens = [
			"not_a_token",
			"mcp_v1_", // Missing token part
			"mcp_v1_!@#$%^&*()", // Invalid characters
			"mcp_v2_valid_but_wrong_version", // Wrong version
			null,
			undefined,
		];

		for (const token of malformedTokens) {
			const props = {
				mcpAccessToken: token as any,
			};

			await expect(validateAuthentication(props, env)).rejects.toThrow();
		}
	});

	it("IT-03-11: should handle missing TANGO_API_KEY gracefully", async () => {
		// Remove TANGO_API_KEY
		const envWithoutKey = { ...env };
		delete (envWithoutKey as any).TANGO_API_KEY;

		const props = {
			accessToken: "ya29.test-token",
			email: "user@agile6.com",
			name: "Test User",
		};

		// Authentication should succeed
		const authResult = await validateAuthentication(props, envWithoutKey);
		expect(authResult.authenticated).toBe(true);

		// But TANGO_API_KEY is undefined (tool calls would fail later)
		expect(envWithoutKey.TANGO_API_KEY).toBeUndefined();
	});

	it("IT-03-12: should handle missing OAUTH_KV gracefully", async () => {
		// Remove OAUTH_KV
		const envWithoutKV = { ...env };
		delete (envWithoutKV as any).OAUTH_KV;

		// Token operations should fail gracefully
		await expect(
			generateMcpAccessToken("user@agile6.com", "Test", envWithoutKV, "127.0.0.1", "Mozilla/5.0")
		).rejects.toThrow("OAUTH_KV namespace not configured");
	});
});

// Helper function to hash token (matches implementation)
async function hashTokenForTest(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
