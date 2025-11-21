/**
 * MCP Access Token System
 *
 * Secure token-based authentication for Agent SDK users.
 * Implements cryptographically secure token generation, SHA-256 hashing,
 * and KV storage with metadata tracking.
 *
 * Token Format: mcp_v1_<base58_random>
 * - Prefix: mcp_v1_ (identifiable, version-aware)
 * - Random: 32 bytes (256-bit entropy) encoded in Base58
 * - Total length: ~50 characters
 *
 * Security Features:
 * - Cryptographically random token generation (crypto.getRandomValues)
 * - SHA-256 hashing for storage (no plaintext tokens)
 * - Constant-time comparison for validation
 * - Usage tracking and metadata
 */

import type { Env } from "../types/env.js";

// ============================================================================
// Token Data Structures
// ============================================================================

/**
 * Token metadata stored in KV
 */
export interface MCPTokenData {
	/** The hashed token value (SHA-256) */
	tokenHash: string;

	/** User ID who owns this token */
	userId: string;

	/** Human-readable description of token purpose */
	description: string;

	/** ISO 8601 timestamp when token was created */
	createdAt: string;

	/** ISO 8601 timestamp when token was last used (null if never used) */
	lastUsedAt: string | null;

	/** ISO 8601 timestamp when token was revoked (null if active) */
	revokedAt: string | null;

	/** Reason for revocation (null if active) */
	revocationReason: string | null;

	/** Token metadata for tracking and auditing */
	metadata: {
		/** IP address where token was created */
		createdFromIp: string;

		/** User agent where token was created */
		createdFromUserAgent: string;

		/** Number of times token has been used */
		usageCount: number;

		/** Last IP address that used this token */
		lastUsedFromIp: string | null;
	};
}

/**
 * Token generation result returned to user (ONLY TIME raw token is shown)
 */
export interface MCPTokenGenerationResult {
	/** The raw token - MUST be saved by user, never shown again */
	token: string;

	/** Unique token ID for reference */
	tokenId: string;

	/** User ID who owns this token */
	userId: string;

	/** Token description */
	description: string;

	/** When token was created */
	createdAt: string;

	/** Warning message to user */
	warning: string;
}

/**
 * Token validation result
 */
export interface MCPTokenValidationResult {
	/** Whether token is valid */
	valid: boolean;

	/** Token ID (if valid) */
	tokenId?: string;

	/** User ID (if valid) */
	userId?: string;

	/** Reason for invalidity (if invalid) */
	reason?: "invalid" | "revoked" | "not_found" | "malformed";

	/** Token data (if valid) */
	tokenData?: MCPTokenData;
}

// ============================================================================
// Base58 Encoding (Bitcoin alphabet)
// ============================================================================

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Encode bytes as Base58 (Bitcoin alphabet)
 * Excludes: 0, O, I, l to avoid visual confusion
 */
function encodeBase58(bytes: Uint8Array): string {
	// Convert bytes to a big integer
	let num = 0n;
	for (const byte of bytes) {
		num = num * 256n + BigInt(byte);
	}

	// Convert to base58
	let encoded = "";
	while (num > 0n) {
		const remainder = Number(num % 58n);
		encoded = BASE58_ALPHABET[remainder] + encoded;
		num = num / 58n;
	}

	// Add leading '1's for leading zero bytes
	for (const byte of bytes) {
		if (byte === 0) {
			encoded = "1" + encoded;
		} else {
			break;
		}
	}

	return encoded;
}

// ============================================================================
// Cryptographic Functions
// ============================================================================

/**
 * Hash a token using SHA-256
 * @param token The raw token string
 * @returns Hex-encoded SHA-256 hash
 */
export async function hashToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	return hashHex;
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param a First string
 * @param b Second string
 * @returns True if strings are equal
 */
function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Generate a new MCP access token
 *
 * @param userId User ID who owns this token (e.g., email or employee ID)
 * @param description Human-readable description of token purpose
 * @param env Cloudflare environment bindings
 * @param createdFromIp IP address where token was created (optional)
 * @param createdFromUserAgent User agent where token was created (optional)
 * @returns Token generation result with raw token (only shown once)
 *
 * @example
 * const result = await generateMcpAccessToken(
 *   "user@example.com",
 *   "My Agent SDK token",
 *   env,
 *   "192.168.1.1",
 *   "Mozilla/5.0"
 * );
 * console.log(result.token); // mcp_v1_8KfR3mN9pQs2tXy7wVz4uBn6hJk5gFd2eC1aL0
 */
export async function generateMcpAccessToken(
	userId: string,
	description: string,
	env: Env,
	createdFromIp = "unknown",
	createdFromUserAgent = "unknown",
): Promise<MCPTokenGenerationResult> {
	// Validate required KV namespace
	if (!env.OAUTH_KV) {
		throw new Error("OAUTH_KV namespace not configured");
	}

	// 1. Generate 32 random bytes (256-bit entropy)
	const randomBytes = new Uint8Array(32);
	crypto.getRandomValues(randomBytes);

	// 2. Encode as Base58
	const base58Random = encodeBase58(randomBytes);

	// 3. Construct token
	const token = `mcp_v1_${base58Random}`;

	// 4. Generate token ID (16 random bytes for shorter ID)
	const tokenIdBytes = new Uint8Array(16);
	crypto.getRandomValues(tokenIdBytes);
	const tokenId = `tok_${encodeBase58(tokenIdBytes)}`;

	// 5. Hash token with SHA-256
	const tokenHash = await hashToken(token);

	// 6. Create token data
	const now = new Date().toISOString();
	const tokenData: MCPTokenData = {
		tokenHash,
		userId,
		description,
		createdAt: now,
		lastUsedAt: null,
		revokedAt: null,
		revocationReason: null,
		metadata: {
			createdFromIp,
			createdFromUserAgent,
			usageCount: 0,
			lastUsedFromIp: null,
		},
	};

	// 7. Store token data in KV
	await env.OAUTH_KV.put(`token:hash:${tokenHash}`, JSON.stringify(tokenData));

	// 8. Add to user's token list
	const userTokensKey = `user:tokens:${userId}`;
	const userTokensJson = await env.OAUTH_KV.get(userTokensKey);
	const userTokens: string[] = userTokensJson ? JSON.parse(userTokensJson) : [];
	userTokens.push(tokenId);
	await env.OAUTH_KV.put(userTokensKey, JSON.stringify(userTokens));

	// 9. Store token ID -> hash mapping
	await env.OAUTH_KV.put(`token:id:${tokenId}`, tokenHash);

	// 10. Return result
	return {
		token,
		tokenId,
		userId,
		description,
		createdAt: now,
		warning: "Save this token now. For security reasons, it will never be shown again.",
	};
}

// ============================================================================
// Token Validation
// ============================================================================

/**
 * Validate an MCP access token
 *
 * Checks token format, verifies it exists in KV, ensures it's not revoked,
 * and updates usage metadata.
 *
 * @param token The raw token to validate
 * @param env Cloudflare environment bindings
 * @param requestIp IP address of the request (optional)
 * @returns Validation result with user ID if valid
 *
 * @example
 * const result = await verifyMcpAccessToken(
 *   "mcp_v1_8KfR3mN9pQs2tXy7wVz4uBn6hJk5gFd2eC1aL0",
 *   env,
 *   "192.168.1.1"
 * );
 * if (result.valid) {
 *   console.log(`Valid token for user: ${result.userId}`);
 * }
 */
export async function verifyMcpAccessToken(
	token: string,
	env: Env,
	requestIp = "unknown",
): Promise<MCPTokenValidationResult> {
	// Validate required KV namespace
	if (!env.OAUTH_KV) {
		return { valid: false, reason: "invalid" };
	}

	// 1-2. Check token format
	if (!token.startsWith("mcp_v1_")) {
		return { valid: false, reason: "malformed" };
	}

	// 3. Hash token
	const tokenHash = await hashToken(token);

	// 4. Look up token data
	const tokenDataJson = await env.OAUTH_KV.get(`token:hash:${tokenHash}`);
	if (!tokenDataJson) {
		return { valid: false, reason: "not_found" };
	}

	const tokenData: MCPTokenData = JSON.parse(tokenDataJson);

	// 6-7. Check if revoked
	if (tokenData.revokedAt !== null) {
		return { valid: false, reason: "revoked" };
	}

	// 8. Update usage metadata (fire-and-forget to avoid blocking)
	updateTokenUsage(env, tokenHash, tokenData, requestIp).catch((err) => {
		console.error("Failed to update token usage:", err);
	});

	// 9. Get token ID
	const tokenId = await getTokenIdFromHash(env, tokenHash);

	// 10. Return valid result
	return {
		valid: true,
		tokenId,
		userId: tokenData.userId,
		tokenData,
	};
}

/**
 * Update token usage metadata
 * Updates lastUsedAt, usageCount, and lastUsedFromIp
 *
 * @param env Cloudflare environment bindings
 * @param tokenHash SHA-256 hash of the token
 * @param tokenData Current token data
 * @param requestIp IP address of the request
 */
async function updateTokenUsage(
	env: Env,
	tokenHash: string,
	tokenData: MCPTokenData,
	requestIp: string,
): Promise<void> {
	if (!env.OAUTH_KV) return;

	const now = new Date().toISOString();

	tokenData.lastUsedAt = now;
	tokenData.metadata.usageCount += 1;
	tokenData.metadata.lastUsedFromIp = requestIp;

	await env.OAUTH_KV.put(`token:hash:${tokenHash}`, JSON.stringify(tokenData));
}

/**
 * Get token ID from token hash
 * Reverse lookup to find the token ID
 *
 * @param env Cloudflare environment bindings
 * @param tokenHash SHA-256 hash of the token
 * @returns Token ID or undefined if not found
 */
async function getTokenIdFromHash(env: Env, tokenHash: string): Promise<string | undefined> {
	if (!env.OAUTH_KV) return undefined;

	// List all token:id:* keys
	const list = await env.OAUTH_KV.list({ prefix: "token:id:" });

	// Find the key that maps to this hash
	for (const key of list.keys) {
		const hash = await env.OAUTH_KV.get(key.name);
		if (hash && constantTimeEqual(hash, tokenHash)) {
			return key.name.replace("token:id:", "");
		}
	}

	return undefined;
}

// ============================================================================
// Token Revocation
// ============================================================================

/**
 * Revoke a single token by token ID
 *
 * @param tokenId Token ID to revoke
 * @param reason Reason for revocation
 * @param env Cloudflare environment bindings
 * @returns Success status and error message if failed
 *
 * @example
 * const result = await revokeMcpAccessToken("tok_abc123", "User requested", env);
 * if (result.success) {
 *   console.log("Token revoked successfully");
 * }
 */
export async function revokeMcpAccessToken(
	tokenId: string,
	reason: string,
	env: Env,
): Promise<{ success: boolean; error?: string }> {
	// Validate required KV namespace
	if (!env.OAUTH_KV) {
		return { success: false, error: "OAUTH_KV namespace not configured" };
	}

	// 1. Look up token hash
	const tokenHash = await env.OAUTH_KV.get(`token:id:${tokenId}`);
	if (!tokenHash) {
		return { success: false, error: "Token not found" };
	}

	// 3. Load token data
	const tokenDataJson = await env.OAUTH_KV.get(`token:hash:${tokenHash}`);
	if (!tokenDataJson) {
		return { success: false, error: "Token data not found" };
	}

	const tokenData: MCPTokenData = JSON.parse(tokenDataJson);

	// Check if already revoked
	if (tokenData.revokedAt !== null) {
		return { success: false, error: "Token already revoked" };
	}

	// 4-5. Update revocation fields
	const now = new Date().toISOString();
	tokenData.revokedAt = now;
	tokenData.revocationReason = reason;

	// 6. Save updated token data
	await env.OAUTH_KV.put(`token:hash:${tokenHash}`, JSON.stringify(tokenData));

	// 7. Add to revoked list
	const revokedListJson = await env.OAUTH_KV.get("revoked:tokens");
	const revokedList: string[] = revokedListJson ? JSON.parse(revokedListJson) : [];
	revokedList.push(tokenId);
	await env.OAUTH_KV.put("revoked:tokens", JSON.stringify(revokedList));

	return { success: true };
}
