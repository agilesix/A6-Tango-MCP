/**
 * KV Cache Manager
 *
 * Manages caching of API responses in Cloudflare KV storage.
 * Features:
 * - Cache-aside pattern
 * - Configurable TTL (default 300s from environment)
 * - JSON serialization/deserialization
 * - Graceful error handling
 * - Pattern-based invalidation
 *
 * Design: Defense in depth - cache failures should never break the application
 */

import type { Env } from "@/types/env";

/**
 * Cache entry metadata
 */
interface CacheEntry<T> {
	/** Cached data */
	data: T;
	/** Timestamp when cached (ISO 8601) */
	cached_at: string;
	/** TTL in seconds */
	ttl_seconds: number;
}

/**
 * Cache operation result
 */
interface CacheResult<T> {
	/** Whether operation succeeded */
	success: boolean;
	/** Retrieved data (if get operation) */
	data?: T;
	/** Whether this was a cache hit */
	hit?: boolean;
	/** Error message (if failed) */
	error?: string;
}

/**
 * Cache Manager for KV storage
 *
 * Provides a clean interface for caching API responses with automatic
 * serialization, TTL management, and error handling.
 */
export class CacheManager {
	private readonly kv: KVNamespace;
	private readonly defaultTtl: number;

	/**
	 * Create a new CacheManager instance
	 *
	 * @param env Cloudflare Workers environment bindings
	 */
	constructor(env: Env) {
		this.kv = env.TANGO_CACHE;
		// Parse TTL from environment or use default (5 minutes)
		this.defaultTtl = env.CACHE_TTL_SECONDS
			? Number.parseInt(env.CACHE_TTL_SECONDS, 10)
			: 300;
	}

	/**
	 * Get value from cache
	 *
	 * @param key Cache key
	 * @returns Cache result with data if found
	 *
	 * @example
	 * ```typescript
	 * const result = await cache.get("search_contracts:abc123");
	 * if (result.hit) {
	 *   console.log("Cache hit:", result.data);
	 * } else {
	 *   console.log("Cache miss");
	 * }
	 * ```
	 */
	async get<T>(key: string): Promise<CacheResult<T>> {
		try {
			// Retrieve from KV
			const cached = await this.kv.get<CacheEntry<T>>(key, "json");

			if (!cached) {
				return {
					success: true,
					hit: false,
				};
			}

			// Return cached data
			return {
				success: true,
				hit: true,
				data: cached.data,
			};
		} catch (error) {
			// Log error but don't fail - cache misses should be transparent
			console.error("Cache get error:", {
				key,
				error: String(error),
			});

			return {
				success: false,
				hit: false,
				error: String(error),
			};
		}
	}

	/**
	 * Set value in cache
	 *
	 * @param key Cache key
	 * @param value Value to cache
	 * @param ttl Time-to-live in seconds (optional, uses default if not provided)
	 * @returns Success status
	 *
	 * @example
	 * ```typescript
	 * await cache.set("search_contracts:abc123", contractData, 300);
	 * ```
	 */
	async set<T>(key: string, value: T, ttl?: number): Promise<CacheResult<T>> {
		try {
			// Create cache entry with metadata
			const entry: CacheEntry<T> = {
				data: value,
				cached_at: new Date().toISOString(),
				ttl_seconds: ttl ?? this.defaultTtl,
			};

			// Store in KV with expiration
			await this.kv.put(key, JSON.stringify(entry), {
				expirationTtl: ttl ?? this.defaultTtl,
			});

			return {
				success: true,
			};
		} catch (error) {
			// Log error but don't fail - cache write failures should be transparent
			console.error("Cache set error:", {
				key,
				ttl: ttl ?? this.defaultTtl,
				error: String(error),
			});

			return {
				success: false,
				error: String(error),
			};
		}
	}

	/**
	 * Invalidate (delete) a specific cache entry
	 *
	 * @param key Cache key to invalidate
	 * @returns Success status
	 *
	 * @example
	 * ```typescript
	 * await cache.invalidate("search_contracts:abc123");
	 * ```
	 */
	async invalidate(key: string): Promise<CacheResult<never>> {
		try {
			await this.kv.delete(key);

			return {
				success: true,
			};
		} catch (error) {
			console.error("Cache invalidate error:", {
				key,
				error: String(error),
			});

			return {
				success: false,
				error: String(error),
			};
		}
	}

	/**
	 * Invalidate all cache entries matching a pattern
	 *
	 * Note: This requires listing keys with a prefix, which can be slow
	 * for large caches. Use sparingly.
	 *
	 * @param pattern Prefix pattern to match (e.g., "search_contracts:")
	 * @returns Success status with count of invalidated keys
	 *
	 * @example
	 * ```typescript
	 * // Invalidate all contract searches
	 * await cache.invalidatePattern("search_contracts:");
	 * ```
	 */
	async invalidatePattern(pattern: string): Promise<CacheResult<{ count: number }>> {
		try {
			let count = 0;
			let cursor: string | undefined;

			// List all keys with prefix
			do {
				const list = await this.kv.list({ prefix: pattern, cursor });

				// Delete each key
				for (const key of list.keys) {
					await this.kv.delete(key.name);
					count++;
				}

				// Check if there are more results
				cursor = list.list_complete ? undefined : list.cursor;
			} while (cursor);

			return {
				success: true,
				data: { count },
			};
		} catch (error) {
			console.error("Cache invalidatePattern error:", {
				pattern,
				error: String(error),
			});

			return {
				success: false,
				error: String(error),
			};
		}
	}

	/**
	 * Get cache statistics
	 *
	 * Note: KV doesn't provide native stats, so this lists all keys
	 * which can be slow. Use sparingly or only in health checks.
	 *
	 * @returns Cache statistics
	 */
	async getStats(): Promise<{
		total_keys: number;
		by_prefix: Record<string, number>;
	}> {
		try {
			let totalKeys = 0;
			const byPrefix: Record<string, number> = {};
			let cursor: string | undefined;

			// List all keys
			do {
				const list = await this.kv.list({ cursor });

				for (const key of list.keys) {
					totalKeys++;

					// Extract prefix (before first colon)
					const prefix = key.name.split(":")[0];
					byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
				}

				// Check if there are more results
				cursor = list.list_complete ? undefined : list.cursor;
			} while (cursor);

			return {
				total_keys: totalKeys,
				by_prefix: byPrefix,
			};
		} catch (error) {
			console.error("Cache getStats error:", error);

			return {
				total_keys: 0,
				by_prefix: {},
			};
		}
	}

	/**
	 * Check if cache is available and operational
	 *
	 * @returns True if cache is working
	 */
	async isAvailable(): Promise<boolean> {
		try {
			// Try a simple write and read
			const testKey = "cache_health_check";
			const testValue = { test: true, timestamp: Date.now() };

			await this.kv.put(testKey, JSON.stringify(testValue), { expirationTtl: 60 });
			const result = await this.kv.get(testKey);

			return result !== null;
		} catch (error) {
			console.error("Cache availability check failed:", error);
			return false;
		}
	}
}

/**
 * Create a CacheManager instance
 *
 * @param env Cloudflare Workers environment bindings
 * @returns CacheManager instance
 */
export function createCacheManager(env: Env): CacheManager {
	return new CacheManager(env);
}
