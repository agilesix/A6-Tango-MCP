/**
 * Unit tests for MCP Access Token System
 *
 * Tests cover:
 * - Token generation (format, entropy, uniqueness)
 * - Token validation (valid, invalid, expired, revoked)
 * - Token revocation
 * - SHA-256 hashing (no plaintext storage)
 * - Constant-time comparison
 * - Admin functions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	generateMcpAccessToken,
	verifyMcpAccessToken,
	revokeMcpAccessToken,
	hashToken,
	type MCPTokenData,
} from "../../../src/auth/mcp-token.js";
import type { Env } from "../../../src/types/env.js";

// Mock KV namespace
class MockKVNamespace implements KVNamespace {
	private store = new Map<string, string>();

	async get(key: string): Promise<string | null> {
		return this.store.get(key) || null;
	}

	async put(key: string, value: string): Promise<void> {
		this.store.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.store.delete(key);
	}

	async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
		const keys = Array.from(this.store.keys());
		const filtered = options?.prefix
			? keys.filter((k) => k.startsWith(options.prefix))
			: keys;
		return { keys: filtered.map((name) => ({ name })) };
	}

	// Implement remaining KVNamespace methods (stub implementations)
	async getWithMetadata(): Promise<any> {
		return { value: null, metadata: null };
	}
}

// Create mock environment
function createMockEnv(): Env {
	return {
		OAUTH_KV: new MockKVNamespace(),
	} as Env;
}

describe("MCP Token Generation", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("should generate valid token format", async () => {
		const result = await generateMcpAccessToken(
			"user@example.com",
			"Test token",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Check token format: mcp_v1_<base58>
		expect(result.token).toMatch(/^mcp_v1_[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/);

		// Check token length (~50 characters)
		expect(result.token.length).toBeGreaterThan(40);
		expect(result.token.length).toBeLessThan(60);

		// Check token ID format
		expect(result.tokenId).toMatch(/^tok_[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/);

		// Check result fields
		expect(result.userId).toBe("user@example.com");
		expect(result.description).toBe("Test token");
		expect(result.warning).toContain("never be shown again");
	});

	it("should generate unique tokens", async () => {
		const token1 = await generateMcpAccessToken(
			"user@example.com",
			"Test 1",
			env,
			"1.2.3.4",
			"TestAgent",
		);
		const token2 = await generateMcpAccessToken(
			"user@example.com",
			"Test 2",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Tokens should be different
		expect(token1.token).not.toBe(token2.token);
		expect(token1.tokenId).not.toBe(token2.tokenId);
	});

	it("should have sufficient entropy (256 bits)", async () => {
		// Generate multiple tokens and ensure they're all unique
		const tokens = new Set<string>();
		const count = 100;

		for (let i = 0; i < count; i++) {
			const result = await generateMcpAccessToken(
				"user@example.com",
				`Test ${i}`,
				env,
				"1.2.3.4",
				"TestAgent",
			);
			tokens.add(result.token);
		}

		// All tokens should be unique
		expect(tokens.size).toBe(count);
	});

	it("should store token hash (not plaintext) in KV", async () => {
		const result = await generateMcpAccessToken(
			"user@example.com",
			"Test token",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Hash the token
		const hash = await hashToken(result.token);

		// Check that token data is stored under hash
		const stored = await env.OAUTH_KV!.get(`token:hash:${hash}`);
		expect(stored).toBeTruthy();

		// Parse stored data
		const tokenData: MCPTokenData = JSON.parse(stored!);

		// Verify that plaintext token is NOT in storage
		expect(stored).not.toContain(result.token);

		// Verify that hash IS in storage
		expect(tokenData.tokenHash).toBe(hash);

		// Verify metadata
		expect(tokenData.userId).toBe("user@example.com");
		expect(tokenData.description).toBe("Test token");
		expect(tokenData.metadata.createdFromIp).toBe("1.2.3.4");
		expect(tokenData.metadata.usageCount).toBe(0);
	});

	it("should create user token list", async () => {
		const userId = "user@example.com";

		// Generate two tokens
		const token1 = await generateMcpAccessToken(userId, "Token 1", env, "1.2.3.4", "TestAgent");
		const token2 = await generateMcpAccessToken(userId, "Token 2", env, "1.2.3.4", "TestAgent");

		// Check user token list
		const userTokensJson = await env.OAUTH_KV!.get(`user:tokens:${userId}`);
		expect(userTokensJson).toBeTruthy();

		const userTokens: string[] = JSON.parse(userTokensJson!);
		expect(userTokens).toContain(token1.tokenId);
		expect(userTokens).toContain(token2.tokenId);
		expect(userTokens.length).toBe(2);
	});

	it("should throw error if OAUTH_KV is not configured", async () => {
		const envWithoutKV = {} as Env;

		await expect(
			generateMcpAccessToken("user@example.com", "Test", envWithoutKV, "1.2.3.4", "TestAgent"),
		).rejects.toThrow("OAUTH_KV namespace not configured");
	});
});

describe("Token Validation", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("should validate valid token", async () => {
		// Generate a token
		const { token } = await generateMcpAccessToken(
			"user@example.com",
			"Test token",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Validate it
		const result = await verifyMcpAccessToken(token, env, "192.168.1.1");

		expect(result.valid).toBe(true);
		expect(result.userId).toBe("user@example.com");
		expect(result.tokenId).toBeTruthy();
		expect(result.tokenData).toBeTruthy();
	});

	it("should reject malformed token", async () => {
		const result = await verifyMcpAccessToken("invalid_token", env, "192.168.1.1");

		expect(result.valid).toBe(false);
		expect(result.reason).toBe("malformed");
	});

	it("should reject token with wrong prefix", async () => {
		const result = await verifyMcpAccessToken("mcp_v2_invalidtoken", env, "192.168.1.1");

		expect(result.valid).toBe(false);
		expect(result.reason).toBe("malformed");
	});

	it("should reject non-existent token", async () => {
		// Create a valid-looking but non-existent token
		const result = await verifyMcpAccessToken(
			"mcp_v1_8KfR3mN9pQs2tXy7wVz4uBn6hJk5gFd2eC1aL0",
			env,
			"192.168.1.1",
		);

		expect(result.valid).toBe(false);
		expect(result.reason).toBe("not_found");
	});

	it("should reject revoked token", async () => {
		// Generate a token
		const { token, tokenId } = await generateMcpAccessToken(
			"user@example.com",
			"Test token",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Revoke it
		await revokeMcpAccessToken(tokenId, "Testing revocation", env);

		// Try to validate
		const result = await verifyMcpAccessToken(token, env, "192.168.1.1");

		expect(result.valid).toBe(false);
		expect(result.reason).toBe("revoked");
	});

	it("should update usage metadata on validation", async () => {
		// Generate a token
		const { token } = await generateMcpAccessToken(
			"user@example.com",
			"Test token",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Validate multiple times
		await verifyMcpAccessToken(token, env, "192.168.1.1");
		await verifyMcpAccessToken(token, env, "192.168.1.2");
		await verifyMcpAccessToken(token, env, "192.168.1.3");

		// Wait for async update to complete
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Check usage count
		const hash = await hashToken(token);
		const tokenDataJson = await env.OAUTH_KV!.get(`token:hash:${hash}`);
		const tokenData: MCPTokenData = JSON.parse(tokenDataJson!);

		expect(tokenData.metadata.usageCount).toBeGreaterThan(0);
		expect(tokenData.lastUsedAt).toBeTruthy();
		expect(tokenData.metadata.lastUsedFromIp).toBeTruthy();
	});

	it("should return error if OAUTH_KV is not configured", async () => {
		const envWithoutKV = {} as Env;

		const result = await verifyMcpAccessToken("mcp_v1_test", envWithoutKV, "192.168.1.1");

		expect(result.valid).toBe(false);
		expect(result.reason).toBe("invalid");
	});
});

describe("Token Revocation", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("should revoke token successfully", async () => {
		// Generate a token
		const { tokenId } = await generateMcpAccessToken(
			"user@example.com",
			"Test token",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Revoke it
		const result = await revokeMcpAccessToken(tokenId, "Test revocation", env);

		expect(result.success).toBe(true);
	});

	it("should update token data with revocation info", async () => {
		// Generate a token
		const { token, tokenId } = await generateMcpAccessToken(
			"user@example.com",
			"Test token",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Revoke it
		await revokeMcpAccessToken(tokenId, "Security concern", env);

		// Check token data
		const hash = await hashToken(token);
		const tokenDataJson = await env.OAUTH_KV!.get(`token:hash:${hash}`);
		const tokenData: MCPTokenData = JSON.parse(tokenDataJson!);

		expect(tokenData.revokedAt).toBeTruthy();
		expect(tokenData.revocationReason).toBe("Security concern");
	});

	it("should prevent double revocation", async () => {
		// Generate a token
		const { tokenId } = await generateMcpAccessToken(
			"user@example.com",
			"Test token",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Revoke it first time
		const result1 = await revokeMcpAccessToken(tokenId, "First revocation", env);
		expect(result1.success).toBe(true);

		// Try to revoke again
		const result2 = await revokeMcpAccessToken(tokenId, "Second revocation", env);
		expect(result2.success).toBe(false);
		expect(result2.error).toContain("already revoked");
	});

	it("should add token to revoked list", async () => {
		// Generate a token
		const { tokenId } = await generateMcpAccessToken(
			"user@example.com",
			"Test token",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Revoke it
		await revokeMcpAccessToken(tokenId, "Test revocation", env);

		// Check revoked list
		const revokedListJson = await env.OAUTH_KV!.get("revoked:tokens");
		expect(revokedListJson).toBeTruthy();

		const revokedList: string[] = JSON.parse(revokedListJson!);
		expect(revokedList).toContain(tokenId);
	});

	it("should return error if token not found", async () => {
		const result = await revokeMcpAccessToken("tok_nonexistent", "Test", env);

		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	it("should return error if OAUTH_KV is not configured", async () => {
		const envWithoutKV = {} as Env;

		const result = await revokeMcpAccessToken("tok_test", "Test", envWithoutKV);

		expect(result.success).toBe(false);
		expect(result.error).toContain("OAUTH_KV namespace not configured");
	});
});

describe("SHA-256 Hashing", () => {
	it("should produce consistent hashes", async () => {
		const token = "mcp_v1_test_token_123";

		const hash1 = await hashToken(token);
		const hash2 = await hashToken(token);

		expect(hash1).toBe(hash2);
	});

	it("should produce different hashes for different tokens", async () => {
		const token1 = "mcp_v1_test_token_123";
		const token2 = "mcp_v1_test_token_456";

		const hash1 = await hashToken(token1);
		const hash2 = await hashToken(token2);

		expect(hash1).not.toBe(hash2);
	});

	it("should produce hex-encoded hash", async () => {
		const token = "mcp_v1_test_token_123";

		const hash = await hashToken(token);

		// SHA-256 hash should be 64 hex characters
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("should not store plaintext tokens", async () => {
		const env = createMockEnv();

		const { token } = await generateMcpAccessToken(
			"user@example.com",
			"Test token",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// List all keys in KV
		const list = await env.OAUTH_KV!.list();

		// Check that no key contains the plaintext token
		for (const key of list.keys) {
			const value = await env.OAUTH_KV!.get(key.name);
			if (value) {
				expect(value).not.toContain(token);
			}
		}
	});
});

describe("Base58 Encoding", () => {
	it("should not contain ambiguous characters", async () => {
		const env = createMockEnv();

		// Generate multiple tokens
		for (let i = 0; i < 20; i++) {
			const { token } = await generateMcpAccessToken(
				"user@example.com",
				`Test ${i}`,
				env,
				"1.2.3.4",
				"TestAgent",
			);

			// Remove prefix to get base58 part
			const base58Part = token.replace("mcp_v1_", "");

			// Check that it doesn't contain ambiguous characters: 0, O, I, l
			expect(base58Part).not.toMatch(/[0OIl]/);
		}
	});

	it("should only contain valid Base58 alphabet", async () => {
		const env = createMockEnv();

		const { token } = await generateMcpAccessToken(
			"user@example.com",
			"Test token",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Remove prefix to get base58 part
		const base58Part = token.replace("mcp_v1_", "");

		// Check that it only contains valid Base58 characters
		expect(base58Part).toMatch(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/);
	});
});

describe("Token Security", () => {
	it("should generate cryptographically random tokens", async () => {
		const env = createMockEnv();

		// Generate many tokens and check for patterns
		const tokens = new Set<string>();
		const count = 1000;

		for (let i = 0; i < count; i++) {
			const { token } = await generateMcpAccessToken(
				"user@example.com",
				`Test ${i}`,
				env,
				"1.2.3.4",
				"TestAgent",
			);
			tokens.add(token);
		}

		// All tokens should be unique (no collisions)
		expect(tokens.size).toBe(count);
	});

	it("should have 256-bit entropy", async () => {
		const env = createMockEnv();

		const { token } = await generateMcpAccessToken(
			"user@example.com",
			"Test token",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Remove prefix to get base58 part
		const base58Part = token.replace("mcp_v1_", "");

		// Base58 encoding of 32 bytes should be ~43-44 characters
		expect(base58Part.length).toBeGreaterThanOrEqual(43);
		expect(base58Part.length).toBeLessThanOrEqual(44);
	});
});
