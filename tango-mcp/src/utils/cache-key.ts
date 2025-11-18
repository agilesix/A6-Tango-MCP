/**
 * Cache Key Generator
 *
 * Generates deterministic cache keys from tool arguments for KV storage.
 * Uses SHA-256 hashing of sorted parameters to ensure consistency.
 *
 * Cache key format: {tool_name}:{hash}
 * Example: "search_contracts:a3b2c1d4e5f6..."
 */

/**
 * Generate a deterministic cache key from tool name and arguments
 *
 * @param toolName Name of the MCP tool
 * @param args Tool arguments object
 * @returns Cache key string in format "toolName:hash"
 *
 * @example
 * ```typescript
 * const key = generateCacheKey("search_contracts", {
 *   vendor_name: "Lockheed Martin",
 *   limit: 10
 * });
 * // Returns: "search_contracts:abc123def456..."
 * ```
 */
export async function generateCacheKey(
	toolName: string,
	args: Record<string, unknown>,
): Promise<string> {
	// Normalize arguments for consistent hashing
	const normalized = normalizeArgs(args);

	// Create sorted JSON string
	const sortedJson = JSON.stringify(normalized, Object.keys(normalized).sort());

	// Hash the arguments
	const hash = await hashString(sortedJson);

	// Return formatted cache key
	return `${toolName}:${hash}`;
}

/**
 * Normalize arguments for consistent cache key generation
 *
 * - Removes undefined, null, and empty string values
 * - Converts arrays to sorted strings for consistency
 * - Recursively processes nested objects
 * - Trims string values
 *
 * @param args Input arguments
 * @returns Normalized arguments object
 */
function normalizeArgs(args: Record<string, unknown>): Record<string, unknown> {
	const normalized: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(args)) {
		// Skip null, undefined, and empty strings
		if (value === null || value === undefined || value === "") {
			continue;
		}

		// Skip api_key - it shouldn't affect cache key
		if (key === "api_key") {
			continue;
		}

		if (typeof value === "string") {
			// Trim and lowercase for case-insensitive consistency
			const trimmed = value.trim();
			if (trimmed.length > 0) {
				normalized[key] = trimmed.toLowerCase();
			}
		} else if (typeof value === "number" || typeof value === "boolean") {
			// Keep numbers and booleans as-is
			normalized[key] = value;
		} else if (Array.isArray(value)) {
			// Sort arrays for consistent ordering
			const filtered = value.filter((item) => item !== null && item !== undefined);
			if (filtered.length > 0) {
				normalized[key] = filtered.map((item) =>
					typeof item === "string" ? item.trim().toLowerCase() : item,
				).sort();
			}
		} else if (typeof value === "object") {
			// Recursively normalize nested objects
			const nested = normalizeArgs(value as Record<string, unknown>);
			if (Object.keys(nested).length > 0) {
				normalized[key] = nested;
			}
		}
	}

	return normalized;
}

/**
 * Hash a string using SHA-256
 *
 * Uses Web Crypto API (available in Cloudflare Workers)
 *
 * @param input String to hash
 * @returns Hex-encoded hash string
 */
async function hashString(input: string): Promise<string> {
	// Encode string as UTF-8
	const encoder = new TextEncoder();
	const data = encoder.encode(input);

	// Generate SHA-256 hash
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);

	// Convert to hex string
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");

	return hashHex;
}

/**
 * Generate cache key synchronously (for testing or non-async contexts)
 *
 * Uses a simpler hash function (not cryptographic)
 * For production, prefer the async version with SHA-256
 *
 * @param toolName Name of the MCP tool
 * @param args Tool arguments object
 * @returns Cache key string
 */
export function generateCacheKeySync(
	toolName: string,
	args: Record<string, unknown>,
): string {
	const normalized = normalizeArgs(args);
	const sortedJson = JSON.stringify(normalized, Object.keys(normalized).sort());

	// Simple hash for sync version (not cryptographic)
	let hash = 0;
	for (let i = 0; i < sortedJson.length; i++) {
		const char = sortedJson.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}

	// Convert to hex
	const hashHex = Math.abs(hash).toString(16).padStart(8, "0");

	return `${toolName}:${hashHex}`;
}
