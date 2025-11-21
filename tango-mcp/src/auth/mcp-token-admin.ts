/**
 * MCP Access Token Admin Functions
 *
 * Administrative functions for managing MCP access tokens.
 * Protected by OAuth authentication (@agile6.com email required).
 *
 * Functions:
 * - List tokens for a user
 * - Get token metadata
 * - Update token description
 * - Delete tokens permanently
 * - Get token usage statistics
 * - Revoke all tokens for a user
 */

import type { Env } from "../types/env.js";
import type { MCPTokenData } from "./mcp-token.js";
import { revokeMcpAccessToken } from "./mcp-token.js";

// ============================================================================
// Token Admin Data Structures
// ============================================================================

/**
 * Token list item for admin interface
 */
export interface MCPTokenListItem {
	/** Unique token ID */
	tokenId: string;

	/** User ID who owns this token */
	userId: string;

	/** Token description */
	description: string;

	/** First 8 chars of token hash for identification */
	tokenPrefix: string;

	/** When token was created */
	createdAt: string;

	/** When token was last used */
	lastUsedAt: string | null;

	/** Whether token is revoked */
	isRevoked: boolean;

	/** Reason for revocation */
	revocationReason: string | null;

	/** Usage count */
	usageCount: number;
}

/**
 * Token usage statistics for a user
 */
export interface MCPTokenStats {
	/** Total number of tokens */
	totalTokens: number;

	/** Number of active (non-revoked) tokens */
	activeTokens: number;

	/** Number of revoked tokens */
	revokedTokens: number;

	/** Total usage count across all tokens */
	totalUsage: number;

	/** When the most recent token was used */
	mostRecentlyUsed: string | null;
}

// ============================================================================
// Token Management Functions
// ============================================================================

/**
 * List all tokens for a user
 *
 * @param userId User ID to list tokens for
 * @param env Cloudflare environment bindings
 * @returns Array of token list items
 *
 * @example
 * const tokens = await listTokensForUser("user@example.com", env);
 * console.log(`User has ${tokens.length} tokens`);
 */
export async function listTokensForUser(
	userId: string,
	env: Env,
): Promise<MCPTokenListItem[]> {
	// Validate required KV namespace
	if (!env.OAUTH_KV) {
		throw new Error("OAUTH_KV namespace not configured");
	}

	const userTokensJson = await env.OAUTH_KV.get(`user:tokens:${userId}`);
	if (!userTokensJson) {
		return [];
	}

	const tokenIds: string[] = JSON.parse(userTokensJson);
	const tokens: MCPTokenListItem[] = [];

	for (const tokenId of tokenIds) {
		const tokenHash = await env.OAUTH_KV.get(`token:id:${tokenId}`);
		if (!tokenHash) continue;

		const tokenDataJson = await env.OAUTH_KV.get(`token:hash:${tokenHash}`);
		if (!tokenDataJson) continue;

		const tokenData: MCPTokenData = JSON.parse(tokenDataJson);

		tokens.push({
			tokenId,
			userId: tokenData.userId,
			description: tokenData.description,
			tokenPrefix: `mcp_v1_...${tokenHash.slice(-8)}`, // Show hash suffix for identification
			createdAt: tokenData.createdAt,
			lastUsedAt: tokenData.lastUsedAt,
			isRevoked: tokenData.revokedAt !== null,
			revocationReason: tokenData.revocationReason,
			usageCount: tokenData.metadata.usageCount,
		});
	}

	return tokens;
}

/**
 * Get detailed token metadata
 *
 * @param tokenId Token ID to get metadata for
 * @param env Cloudflare environment bindings
 * @returns Token metadata or error
 *
 * @example
 * const result = await getTokenMetadata("tok_abc123", env);
 * if (result.success) {
 *   console.log(`Token created at: ${result.data.createdAt}`);
 * }
 */
export async function getTokenMetadata(
	tokenId: string,
	env: Env,
): Promise<{ success: boolean; data?: MCPTokenData; error?: string }> {
	// Validate required KV namespace
	if (!env.OAUTH_KV) {
		return { success: false, error: "OAUTH_KV namespace not configured" };
	}

	const tokenHash = await env.OAUTH_KV.get(`token:id:${tokenId}`);
	if (!tokenHash) {
		return { success: false, error: "Token not found" };
	}

	const tokenDataJson = await env.OAUTH_KV.get(`token:hash:${tokenHash}`);
	if (!tokenDataJson) {
		return { success: false, error: "Token data not found" };
	}

	const tokenData: MCPTokenData = JSON.parse(tokenDataJson);
	return { success: true, data: tokenData };
}

/**
 * Update token description
 *
 * @param tokenId Token ID to update
 * @param newDescription New description for the token
 * @param env Cloudflare environment bindings
 * @returns Success status and error message if failed
 *
 * @example
 * const result = await updateTokenDescription("tok_abc123", "Updated description", env);
 * if (result.success) {
 *   console.log("Description updated successfully");
 * }
 */
export async function updateTokenDescription(
	tokenId: string,
	newDescription: string,
	env: Env,
): Promise<{ success: boolean; error?: string }> {
	// Validate required KV namespace
	if (!env.OAUTH_KV) {
		return { success: false, error: "OAUTH_KV namespace not configured" };
	}

	const tokenHash = await env.OAUTH_KV.get(`token:id:${tokenId}`);
	if (!tokenHash) {
		return { success: false, error: "Token not found" };
	}

	const tokenDataJson = await env.OAUTH_KV.get(`token:hash:${tokenHash}`);
	if (!tokenDataJson) {
		return { success: false, error: "Token data not found" };
	}

	const tokenData: MCPTokenData = JSON.parse(tokenDataJson);
	tokenData.description = newDescription;

	await env.OAUTH_KV.put(`token:hash:${tokenHash}`, JSON.stringify(tokenData));

	return { success: true };
}

/**
 * Delete a token permanently
 *
 * CAUTION: This permanently deletes the token from storage.
 * Consider revoking instead unless you need to completely remove the token.
 *
 * @param tokenId Token ID to delete
 * @param env Cloudflare environment bindings
 * @returns Success status and error message if failed
 *
 * @example
 * const result = await deleteToken("tok_abc123", env);
 * if (result.success) {
 *   console.log("Token deleted permanently");
 * }
 */
export async function deleteToken(
	tokenId: string,
	env: Env,
): Promise<{ success: boolean; error?: string }> {
	// Validate required KV namespace
	if (!env.OAUTH_KV) {
		return { success: false, error: "OAUTH_KV namespace not configured" };
	}

	// Get token hash
	const tokenHash = await env.OAUTH_KV.get(`token:id:${tokenId}`);
	if (!tokenHash) {
		return { success: false, error: "Token not found" };
	}

	// Get token data to find user ID
	const tokenDataJson = await env.OAUTH_KV.get(`token:hash:${tokenHash}`);
	if (!tokenDataJson) {
		return { success: false, error: "Token data not found" };
	}

	const tokenData: MCPTokenData = JSON.parse(tokenDataJson);

	// Delete token data
	await env.OAUTH_KV.delete(`token:hash:${tokenHash}`);

	// Delete token ID mapping
	await env.OAUTH_KV.delete(`token:id:${tokenId}`);

	// Remove from user's token list
	const userTokensKey = `user:tokens:${tokenData.userId}`;
	const userTokensJson = await env.OAUTH_KV.get(userTokensKey);
	if (userTokensJson) {
		const userTokens: string[] = JSON.parse(userTokensJson);
		const updatedTokens = userTokens.filter((id) => id !== tokenId);
		await env.OAUTH_KV.put(userTokensKey, JSON.stringify(updatedTokens));
	}

	// Remove from revoked list if present
	const revokedListJson = await env.OAUTH_KV.get("revoked:tokens");
	if (revokedListJson) {
		const revokedList: string[] = JSON.parse(revokedListJson);
		const updatedList = revokedList.filter((id) => id !== tokenId);
		await env.OAUTH_KV.put("revoked:tokens", JSON.stringify(updatedList));
	}

	return { success: true };
}

/**
 * Get token usage statistics for a user
 *
 * @param userId User ID to get statistics for
 * @param env Cloudflare environment bindings
 * @returns Token usage statistics
 *
 * @example
 * const stats = await getTokenStats("user@example.com", env);
 * console.log(`Total tokens: ${stats.totalTokens}, Active: ${stats.activeTokens}`);
 */
export async function getTokenStats(
	userId: string,
	env: Env,
): Promise<MCPTokenStats> {
	const tokens = await listTokensForUser(userId, env);

	const stats: MCPTokenStats = {
		totalTokens: tokens.length,
		activeTokens: tokens.filter((t) => !t.isRevoked).length,
		revokedTokens: tokens.filter((t) => t.isRevoked).length,
		totalUsage: tokens.reduce((sum, t) => sum + t.usageCount, 0),
		mostRecentlyUsed: null,
	};

	// Find most recently used token
	const sortedByLastUsed = tokens
		.filter((t) => t.lastUsedAt !== null)
		.sort((a, b) => {
			if (!a.lastUsedAt) return 1;
			if (!b.lastUsedAt) return -1;
			return (
				new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
			);
		});

	if (sortedByLastUsed.length > 0 && sortedByLastUsed[0].lastUsedAt) {
		stats.mostRecentlyUsed = sortedByLastUsed[0].lastUsedAt;
	}

	return stats;
}

/**
 * Revoke all tokens for a user
 *
 * @param userId User ID to revoke tokens for
 * @param reason Reason for revocation
 * @param env Cloudflare environment bindings
 * @returns Success status, count of revoked tokens, and any errors
 *
 * @example
 * const result = await revokeAllUserTokens("user@example.com", "User left company", env);
 * console.log(`Revoked ${result.revokedCount} tokens`);
 */
export async function revokeAllUserTokens(
	userId: string,
	reason: string,
	env: Env,
): Promise<{ success: boolean; revokedCount: number; errors: string[] }> {
	// Validate required KV namespace
	if (!env.OAUTH_KV) {
		return {
			success: false,
			revokedCount: 0,
			errors: ["OAUTH_KV namespace not configured"],
		};
	}

	// 1. Load user's token list
	const userTokensJson = await env.OAUTH_KV.get(`user:tokens:${userId}`);
	if (!userTokensJson) {
		return { success: true, revokedCount: 0, errors: [] };
	}

	const userTokens: string[] = JSON.parse(userTokensJson);

	// 2-3. Revoke each token
	let revokedCount = 0;
	const errors: string[] = [];

	for (const tokenId of userTokens) {
		const result = await revokeMcpAccessToken(tokenId, reason, env);
		if (result.success) {
			revokedCount++;
		} else if (result.error && !result.error.includes("already revoked")) {
			// Ignore "already revoked" errors, count as successful
			errors.push(`${tokenId}: ${result.error}`);
		}
	}

	return { success: true, revokedCount, errors };
}

/**
 * Un-revoke a token (restore it)
 *
 * CAUTION: Use this carefully. Only restore tokens that were revoked by mistake.
 *
 * @param tokenId Token ID to un-revoke
 * @param env Cloudflare environment bindings
 * @returns Success status and error message if failed
 *
 * @example
 * const result = await unrevokeToken("tok_abc123", env);
 * if (result.success) {
 *   console.log("Token restored successfully");
 * }
 */
export async function unrevokeToken(
	tokenId: string,
	env: Env,
): Promise<{ success: boolean; error?: string }> {
	// Validate required KV namespace
	if (!env.OAUTH_KV) {
		return { success: false, error: "OAUTH_KV namespace not configured" };
	}

	const tokenHash = await env.OAUTH_KV.get(`token:id:${tokenId}`);
	if (!tokenHash) {
		return { success: false, error: "Token not found" };
	}

	const tokenDataJson = await env.OAUTH_KV.get(`token:hash:${tokenHash}`);
	if (!tokenDataJson) {
		return { success: false, error: "Token data not found" };
	}

	const tokenData: MCPTokenData = JSON.parse(tokenDataJson);

	// Clear revocation fields
	tokenData.revokedAt = null;
	tokenData.revocationReason = null;

	await env.OAUTH_KV.put(`token:hash:${tokenHash}`, JSON.stringify(tokenData));

	// Remove from revoked list
	const revokedListJson = await env.OAUTH_KV.get("revoked:tokens");
	if (revokedListJson) {
		const revokedList: string[] = JSON.parse(revokedListJson);
		const updatedList = revokedList.filter((id) => id !== tokenId);
		await env.OAUTH_KV.put("revoked:tokens", JSON.stringify(updatedList));
	}

	return { success: true };
}

/**
 * Validate that the request is from an authorized admin user
 *
 * @param email User's email from OAuth
 * @param requiredDomain Required domain (e.g., "agile6.com")
 * @returns True if user is authorized
 *
 * @example
 * const isAdmin = validateAdminAccess(userEmail, "agile6.com");
 * if (!isAdmin) {
 *   throw new Error("Unauthorized: Admin access required");
 * }
 */
export function validateAdminAccess(
	email: string | undefined,
	requiredDomain: string,
): boolean {
	if (!email) return false;
	return email.endsWith(`@${requiredDomain}`);
}
