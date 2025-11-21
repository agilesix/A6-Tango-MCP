/**
 * Rate Limiting Module for Tango MCP Server
 *
 * Implements distributed rate limiting using Cloudflare KV for:
 * - Per-IP rate limiting for auth endpoints
 * - Per-user rate limiting for tool usage
 * - Configurable limits from environment variables
 *
 * Returns 429 Too Many Requests when limits are exceeded.
 */

import type { Env } from "../types/env.js";

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
	/** Maximum number of requests allowed in the window */
	maxRequests: number;
	/** Time window in milliseconds */
	windowMs: number;
	/** Key prefix for KV storage */
	keyPrefix: string;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
	/** Whether the request is allowed */
	allowed: boolean;
	/** Current request count in the window */
	currentCount: number;
	/** Maximum allowed requests */
	limit: number;
	/** Time until the window resets (in seconds) */
	resetIn: number;
	/** Timestamp when the window resets */
	resetAt: number;
}

/**
 * Rate limit configurations for different endpoint types
 */
export const RATE_LIMIT_CONFIGS = {
	// OAuth endpoints: 10 requests per minute per IP
	AUTH_ENDPOINT: {
		maxRequests: parseInt(process.env.RATE_LIMIT_AUTH_MAX || "10"),
		windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW || "60000"), // 1 minute
		keyPrefix: "rate_limit:auth",
	} as RateLimitConfig,

	// MCP token validation: 20 requests per minute per IP
	TOKEN_VALIDATION: {
		maxRequests: parseInt(process.env.RATE_LIMIT_TOKEN_MAX || "20"),
		windowMs: parseInt(process.env.RATE_LIMIT_TOKEN_WINDOW || "60000"), // 1 minute
		keyPrefix: "rate_limit:token",
	} as RateLimitConfig,

	// Tool execution: 60 requests per minute per user
	TOOL_EXECUTION: {
		maxRequests: parseInt(process.env.RATE_LIMIT_TOOL_MAX || "60"),
		windowMs: parseInt(process.env.RATE_LIMIT_TOOL_WINDOW || "60000"), // 1 minute
		keyPrefix: "rate_limit:tool",
	} as RateLimitConfig,

	// Global rate limit: 1000 requests per minute (across all IPs)
	GLOBAL: {
		maxRequests: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || "1000"),
		windowMs: parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW || "60000"), // 1 minute
		keyPrefix: "rate_limit:global",
	} as RateLimitConfig,
};

/**
 * Rate limiter class using Cloudflare KV for distributed tracking
 */
export class RateLimiter {
	private config: RateLimitConfig;
	private kv: KVNamespace;

	constructor(config: RateLimitConfig, kv: KVNamespace) {
		this.config = config;
		this.kv = kv;
	}

	/**
	 * Check if a request is allowed under the rate limit
	 *
	 * @param key - Unique identifier for rate limiting (IP address, user ID, etc.)
	 * @returns Rate limit check result
	 */
	async check(key: string): Promise<RateLimitResult> {
		const now = Date.now();
		const rateLimitKey = `${this.config.keyPrefix}:${key}`;

		// Get current count from KV
		const currentData = await this.kv.get(rateLimitKey, "json") as {
			count: number;
			windowStart: number;
		} | null;

		// Calculate window boundaries
		const windowStart = now;
		const windowEnd = now + this.config.windowMs;
		const resetIn = Math.ceil(this.config.windowMs / 1000);
		const resetAt = windowEnd;

		// If no existing data or window has expired, start fresh
		if (!currentData || (now - currentData.windowStart) >= this.config.windowMs) {
			// First request in this window
			await this.kv.put(
				rateLimitKey,
				JSON.stringify({ count: 1, windowStart }),
				{ expirationTtl: Math.ceil(this.config.windowMs / 1000) + 60 } // Add buffer
			);

			return {
				allowed: true,
				currentCount: 1,
				limit: this.config.maxRequests,
				resetIn,
				resetAt,
			};
		}

		// Window is still active, check if we're under the limit
		const currentCount = currentData.count;

		if (currentCount >= this.config.maxRequests) {
			// Rate limit exceeded
			const timeRemaining = this.config.windowMs - (now - currentData.windowStart);
			return {
				allowed: false,
				currentCount,
				limit: this.config.maxRequests,
				resetIn: Math.ceil(timeRemaining / 1000),
				resetAt: currentData.windowStart + this.config.windowMs,
			};
		}

		// Increment count
		const newCount = currentCount + 1;
		await this.kv.put(
			rateLimitKey,
			JSON.stringify({ count: newCount, windowStart: currentData.windowStart }),
			{ expirationTtl: Math.ceil(this.config.windowMs / 1000) + 60 }
		);

		return {
			allowed: true,
			currentCount: newCount,
			limit: this.config.maxRequests,
			resetIn: Math.ceil((this.config.windowMs - (now - currentData.windowStart)) / 1000),
			resetAt: currentData.windowStart + this.config.windowMs,
		};
	}

	/**
	 * Reset the rate limit for a specific key (admin function)
	 *
	 * @param key - Unique identifier to reset
	 */
	async reset(key: string): Promise<void> {
		const rateLimitKey = `${this.config.keyPrefix}:${key}`;
		await this.kv.delete(rateLimitKey);
	}

	/**
	 * Get current rate limit status without incrementing
	 *
	 * @param key - Unique identifier to check
	 * @returns Current rate limit status
	 */
	async getStatus(key: string): Promise<RateLimitResult> {
		const now = Date.now();
		const rateLimitKey = `${this.config.keyPrefix}:${key}`;

		const currentData = await this.kv.get(rateLimitKey, "json") as {
			count: number;
			windowStart: number;
		} | null;

		if (!currentData || (now - currentData.windowStart) >= this.config.windowMs) {
			return {
				allowed: true,
				currentCount: 0,
				limit: this.config.maxRequests,
				resetIn: Math.ceil(this.config.windowMs / 1000),
				resetAt: now + this.config.windowMs,
			};
		}

		const timeRemaining = this.config.windowMs - (now - currentData.windowStart);
		return {
			allowed: currentData.count < this.config.maxRequests,
			currentCount: currentData.count,
			limit: this.config.maxRequests,
			resetIn: Math.ceil(timeRemaining / 1000),
			resetAt: currentData.windowStart + this.config.windowMs,
		};
	}
}

/**
 * Helper function to extract client IP from request
 *
 * @param request - Incoming request
 * @returns Client IP address
 */
export function getClientIP(request: Request): string {
	// Try Cloudflare's CF-Connecting-IP header first
	const cfIP = request.headers.get("CF-Connecting-IP");
	if (cfIP) return cfIP;

	// Fallback to X-Forwarded-For
	const forwardedFor = request.headers.get("X-Forwarded-For");
	if (forwardedFor) {
		const ips = forwardedFor.split(",").map((ip) => ip.trim());
		return ips[0];
	}

	// Last resort: X-Real-IP
	const realIP = request.headers.get("X-Real-IP");
	if (realIP) return realIP;

	return "unknown";
}

/**
 * Create rate limiters for the application
 *
 * @param env - Environment configuration
 * @returns Map of rate limiters by type
 */
export function createRateLimiters(env: Env): {
	auth: RateLimiter;
	token: RateLimiter;
	tool: RateLimiter;
	global: RateLimiter;
} {
	if (!env.OAUTH_KV) {
		throw new Error("OAUTH_KV is required for rate limiting");
	}

	return {
		auth: new RateLimiter(RATE_LIMIT_CONFIGS.AUTH_ENDPOINT, env.OAUTH_KV),
		token: new RateLimiter(RATE_LIMIT_CONFIGS.TOKEN_VALIDATION, env.OAUTH_KV),
		tool: new RateLimiter(RATE_LIMIT_CONFIGS.TOOL_EXECUTION, env.OAUTH_KV),
		global: new RateLimiter(RATE_LIMIT_CONFIGS.GLOBAL, env.OAUTH_KV),
	};
}

/**
 * Apply rate limiting to a request
 *
 * @param limiter - Rate limiter instance
 * @param key - Unique identifier for rate limiting
 * @returns Response if rate limited, null if allowed
 */
export async function applyRateLimit(
	limiter: RateLimiter,
	key: string
): Promise<Response | null> {
	const result = await limiter.check(key);

	if (!result.allowed) {
		return new Response(
			JSON.stringify({
				error: "Rate limit exceeded",
				message: "Too many requests. Please try again later.",
				limit: result.limit,
				current: result.currentCount,
				resetIn: result.resetIn,
				resetAt: new Date(result.resetAt).toISOString(),
			}),
			{
				status: 429,
				headers: {
					"Content-Type": "application/json",
					"Retry-After": String(result.resetIn),
					"X-RateLimit-Limit": String(result.limit),
					"X-RateLimit-Remaining": String(Math.max(0, result.limit - result.currentCount)),
					"X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
				},
			}
		);
	}

	return null;
}

/**
 * Add rate limit headers to a response
 *
 * @param response - Response to add headers to
 * @param result - Rate limit result
 * @returns Response with rate limit headers
 */
export function addRateLimitHeaders(
	response: Response,
	result: RateLimitResult
): Response {
	const headers = new Headers(response.headers);
	headers.set("X-RateLimit-Limit", String(result.limit));
	headers.set("X-RateLimit-Remaining", String(Math.max(0, result.limit - result.currentCount)));
	headers.set("X-RateLimit-Reset", String(Math.floor(result.resetAt / 1000)));

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
