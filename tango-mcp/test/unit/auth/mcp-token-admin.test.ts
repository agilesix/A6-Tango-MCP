/**
 * Unit tests for MCP Access Token Admin Functions
 *
 * Tests cover:
 * - List tokens for a user
 * - Get token metadata
 * - Update token description
 * - Delete tokens
 * - Get token usage statistics
 * - Revoke all user tokens
 * - Un-revoke tokens
 * - Admin access validation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	listTokensForUser,
	getTokenMetadata,
	updateTokenDescription,
	deleteToken,
	getTokenStats,
	revokeAllUserTokens,
	unrevokeToken,
	validateAdminAccess,
} from "../../../src/auth/mcp-token-admin.js";
import { generateMcpAccessToken, revokeMcpAccessToken } from "../../../src/auth/mcp-token.js";
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

describe("List Tokens for User", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("should list all tokens for a user", async () => {
		const userId = "user@example.com";

		// Generate tokens
		await generateMcpAccessToken(userId, "Token 1", env, "1.2.3.4", "TestAgent");
		await generateMcpAccessToken(userId, "Token 2", env, "1.2.3.4", "TestAgent");
		await generateMcpAccessToken(userId, "Token 3", env, "1.2.3.4", "TestAgent");

		// List tokens
		const tokens = await listTokensForUser(userId, env);

		expect(tokens.length).toBe(3);
		expect(tokens[0].userId).toBe(userId);
		expect(tokens[0].description).toBe("Token 1");
	});

	it("should return empty array for user with no tokens", async () => {
		const tokens = await listTokensForUser("newuser@example.com", env);

		expect(tokens).toEqual([]);
	});

	it("should show token status (active/revoked)", async () => {
		const userId = "user@example.com";

		// Generate tokens
		const token1 = await generateMcpAccessToken(userId, "Active Token", env, "1.2.3.4", "TestAgent");
		const token2 = await generateMcpAccessToken(userId, "Revoked Token", env, "1.2.3.4", "TestAgent");

		// Revoke one token
		await revokeMcpAccessToken(token2.tokenId, "Test revocation", env);

		// List tokens
		const tokens = await listTokensForUser(userId, env);

		const activeToken = tokens.find((t) => t.description === "Active Token");
		const revokedToken = tokens.find((t) => t.description === "Revoked Token");

		expect(activeToken?.isRevoked).toBe(false);
		expect(revokedToken?.isRevoked).toBe(true);
		expect(revokedToken?.revocationReason).toBe("Test revocation");
	});

	it("should show usage count", async () => {
		const userId = "user@example.com";

		// Generate token
		await generateMcpAccessToken(userId, "Test Token", env, "1.2.3.4", "TestAgent");

		// List tokens
		const tokens = await listTokensForUser(userId, env);

		expect(tokens[0].usageCount).toBe(0);
	});

	it("should throw error if OAUTH_KV is not configured", async () => {
		const envWithoutKV = {} as Env;

		await expect(listTokensForUser("user@example.com", envWithoutKV)).rejects.toThrow(
			"OAUTH_KV namespace not configured",
		);
	});
});

describe("Get Token Metadata", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("should get detailed token metadata", async () => {
		const { tokenId } = await generateMcpAccessToken(
			"user@example.com",
			"Test Token",
			env,
			"1.2.3.4",
			"TestAgent/1.0",
		);

		const result = await getTokenMetadata(tokenId, env);

		expect(result.success).toBe(true);
		expect(result.data).toBeTruthy();
		expect(result.data?.userId).toBe("user@example.com");
		expect(result.data?.description).toBe("Test Token");
		expect(result.data?.metadata.createdFromIp).toBe("1.2.3.4");
		expect(result.data?.metadata.createdFromUserAgent).toBe("TestAgent/1.0");
	});

	it("should return error for non-existent token", async () => {
		const result = await getTokenMetadata("tok_nonexistent", env);

		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	it("should return error if OAUTH_KV is not configured", async () => {
		const envWithoutKV = {} as Env;

		const result = await getTokenMetadata("tok_test", envWithoutKV);

		expect(result.success).toBe(false);
		expect(result.error).toContain("OAUTH_KV namespace not configured");
	});
});

describe("Update Token Description", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("should update token description", async () => {
		const { tokenId } = await generateMcpAccessToken(
			"user@example.com",
			"Old Description",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Update description
		const result = await updateTokenDescription(tokenId, "New Description", env);

		expect(result.success).toBe(true);

		// Verify update
		const metadata = await getTokenMetadata(tokenId, env);
		expect(metadata.data?.description).toBe("New Description");
	});

	it("should return error for non-existent token", async () => {
		const result = await updateTokenDescription("tok_nonexistent", "New Description", env);

		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	it("should return error if OAUTH_KV is not configured", async () => {
		const envWithoutKV = {} as Env;

		const result = await updateTokenDescription("tok_test", "New Description", envWithoutKV);

		expect(result.success).toBe(false);
		expect(result.error).toContain("OAUTH_KV namespace not configured");
	});
});

describe("Delete Token", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("should delete token permanently", async () => {
		const userId = "user@example.com";
		const { tokenId } = await generateMcpAccessToken(userId, "Test Token", env, "1.2.3.4", "TestAgent");

		// Delete token
		const result = await deleteToken(tokenId, env);

		expect(result.success).toBe(true);

		// Verify deletion - token should not be found
		const metadata = await getTokenMetadata(tokenId, env);
		expect(metadata.success).toBe(false);

		// Verify removed from user's token list
		const tokens = await listTokensForUser(userId, env);
		expect(tokens.find((t) => t.tokenId === tokenId)).toBeUndefined();
	});

	it("should remove token from revoked list if present", async () => {
		const { tokenId } = await generateMcpAccessToken(
			"user@example.com",
			"Test Token",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Revoke token
		await revokeMcpAccessToken(tokenId, "Test revocation", env);

		// Delete token
		await deleteToken(tokenId, env);

		// Check revoked list
		const revokedListJson = await env.OAUTH_KV!.get("revoked:tokens");
		if (revokedListJson) {
			const revokedList: string[] = JSON.parse(revokedListJson);
			expect(revokedList).not.toContain(tokenId);
		}
	});

	it("should return error for non-existent token", async () => {
		const result = await deleteToken("tok_nonexistent", env);

		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	it("should return error if OAUTH_KV is not configured", async () => {
		const envWithoutKV = {} as Env;

		const result = await deleteToken("tok_test", envWithoutKV);

		expect(result.success).toBe(false);
		expect(result.error).toContain("OAUTH_KV namespace not configured");
	});
});

describe("Get Token Stats", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("should calculate token statistics", async () => {
		const userId = "user@example.com";

		// Generate tokens
		await generateMcpAccessToken(userId, "Token 1", env, "1.2.3.4", "TestAgent");
		await generateMcpAccessToken(userId, "Token 2", env, "1.2.3.4", "TestAgent");
		const token3 = await generateMcpAccessToken(userId, "Token 3", env, "1.2.3.4", "TestAgent");

		// Revoke one token
		await revokeMcpAccessToken(token3.tokenId, "Test revocation", env);

		// Get stats
		const stats = await getTokenStats(userId, env);

		expect(stats.totalTokens).toBe(3);
		expect(stats.activeTokens).toBe(2);
		expect(stats.revokedTokens).toBe(1);
		expect(stats.totalUsage).toBe(0); // No usage yet
	});

	it("should return zero stats for user with no tokens", async () => {
		const stats = await getTokenStats("newuser@example.com", env);

		expect(stats.totalTokens).toBe(0);
		expect(stats.activeTokens).toBe(0);
		expect(stats.revokedTokens).toBe(0);
		expect(stats.totalUsage).toBe(0);
		expect(stats.mostRecentlyUsed).toBeNull();
	});
});

describe("Revoke All User Tokens", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("should revoke all tokens for a user", async () => {
		const userId = "user@example.com";

		// Generate tokens
		await generateMcpAccessToken(userId, "Token 1", env, "1.2.3.4", "TestAgent");
		await generateMcpAccessToken(userId, "Token 2", env, "1.2.3.4", "TestAgent");
		await generateMcpAccessToken(userId, "Token 3", env, "1.2.3.4", "TestAgent");

		// Revoke all
		const result = await revokeAllUserTokens(userId, "User left company", env);

		expect(result.success).toBe(true);
		expect(result.revokedCount).toBe(3);
		expect(result.errors.length).toBe(0);

		// Verify all tokens are revoked
		const tokens = await listTokensForUser(userId, env);
		expect(tokens.every((t) => t.isRevoked)).toBe(true);
	});

	it("should handle user with no tokens", async () => {
		const result = await revokeAllUserTokens("newuser@example.com", "Test", env);

		expect(result.success).toBe(true);
		expect(result.revokedCount).toBe(0);
		expect(result.errors.length).toBe(0);
	});

	it("should return error if OAUTH_KV is not configured", async () => {
		const envWithoutKV = {} as Env;

		const result = await revokeAllUserTokens("user@example.com", "Test", envWithoutKV);

		expect(result.success).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0]).toContain("OAUTH_KV namespace not configured");
	});
});

describe("Un-revoke Token", () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	it("should restore a revoked token", async () => {
		const { tokenId } = await generateMcpAccessToken(
			"user@example.com",
			"Test Token",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Revoke token
		await revokeMcpAccessToken(tokenId, "Test revocation", env);

		// Verify it's revoked
		const metadata1 = await getTokenMetadata(tokenId, env);
		expect(metadata1.data?.revokedAt).toBeTruthy();

		// Un-revoke it
		const result = await unrevokeToken(tokenId, env);
		expect(result.success).toBe(true);

		// Verify it's restored
		const metadata2 = await getTokenMetadata(tokenId, env);
		expect(metadata2.data?.revokedAt).toBeNull();
		expect(metadata2.data?.revocationReason).toBeNull();
	});

	it("should remove token from revoked list", async () => {
		const { tokenId } = await generateMcpAccessToken(
			"user@example.com",
			"Test Token",
			env,
			"1.2.3.4",
			"TestAgent",
		);

		// Revoke token
		await revokeMcpAccessToken(tokenId, "Test revocation", env);

		// Un-revoke it
		await unrevokeToken(tokenId, env);

		// Check revoked list
		const revokedListJson = await env.OAUTH_KV!.get("revoked:tokens");
		if (revokedListJson) {
			const revokedList: string[] = JSON.parse(revokedListJson);
			expect(revokedList).not.toContain(tokenId);
		}
	});

	it("should return error for non-existent token", async () => {
		const result = await unrevokeToken("tok_nonexistent", env);

		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	it("should return error if OAUTH_KV is not configured", async () => {
		const envWithoutKV = {} as Env;

		const result = await unrevokeToken("tok_test", envWithoutKV);

		expect(result.success).toBe(false);
		expect(result.error).toContain("OAUTH_KV namespace not configured");
	});
});

describe("Validate Admin Access", () => {
	it("should validate @agile6.com email", () => {
		expect(validateAdminAccess("admin@agile6.com", "agile6.com")).toBe(true);
		expect(validateAdminAccess("user@agile6.com", "agile6.com")).toBe(true);
	});

	it("should reject non-agile6 email", () => {
		expect(validateAdminAccess("user@gmail.com", "agile6.com")).toBe(false);
		expect(validateAdminAccess("user@example.com", "agile6.com")).toBe(false);
	});

	it("should reject undefined email", () => {
		expect(validateAdminAccess(undefined, "agile6.com")).toBe(false);
	});

	it("should be case-sensitive for subdomain", () => {
		// Should match exact domain
		expect(validateAdminAccess("user@agile6.com", "agile6.com")).toBe(true);

		// Should not match different domain
		expect(validateAdminAccess("user@subdomain.agile6.com", "agile6.com")).toBe(false);
	});

	it("should support different domains", () => {
		expect(validateAdminAccess("user@example.org", "example.org")).toBe(true);
		expect(validateAdminAccess("user@test.com", "test.com")).toBe(true);
	});
});
