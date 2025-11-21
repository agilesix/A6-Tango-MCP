/**
 * Tests for rate limiting module
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	RateLimiter,
	RATE_LIMIT_CONFIGS,
	createRateLimiters,
	getClientIP,
	applyRateLimit,
	addRateLimitHeaders,
} from "../../src/security/rate-limiting";

// Mock KV namespace
class MockKVNamespace implements KVNamespace {
	private store = new Map<string, string>();
	private expirations = new Map<string, number>();

	async get(key: string, options?: { type?: "json" }): Promise<any> {
		// Check if expired
		const expiration = this.expirations.get(key);
		if (expiration && Date.now() > expiration) {
			this.store.delete(key);
			this.expirations.delete(key);
			return null;
		}

		const value = this.store.get(key);
		if (value === undefined) return null;
		if (!value) return null;
		return options?.type === "json" ? JSON.parse(value) : value;
	}

	async put(
		key: string,
		value: string,
		options?: { expirationTtl?: number }
	): Promise<void> {
		this.store.set(key, value);
		if (options?.expirationTtl) {
			this.expirations.set(key, Date.now() + options.expirationTtl * 1000);
		}
	}

	async delete(key: string): Promise<void> {
		this.store.delete(key);
		this.expirations.delete(key);
	}

	async list(): Promise<any> {
		return { keys: [] };
	}

	async getWithMetadata(): Promise<any> {
		return { value: null, metadata: null };
	}
}

describe("RateLimiter", () => {
	let kv: MockKVNamespace;
	let limiter: RateLimiter;

	beforeEach(() => {
		kv = new MockKVNamespace();
		limiter = new RateLimiter(
			{
				maxRequests: 5,
				windowMs: 60000,
				keyPrefix: "test",
			},
			kv as any
		);
	});

	describe("check()", () => {
		it("should allow first request", async () => {
			const result = await limiter.check("test-key");
			expect(result.allowed).toBe(true);
			expect(result.currentCount).toBe(1);
			expect(result.limit).toBe(5);
		});

		it("should allow requests up to limit", async () => {
			for (let i = 1; i <= 5; i++) {
				const result = await limiter.check("test-key");
				expect(result.allowed).toBe(true);
				expect(result.currentCount).toBe(i);
			}
		});

		it("should reject requests over limit", async () => {
			// Make 5 allowed requests
			for (let i = 0; i < 5; i++) {
				await limiter.check("test-key");
			}

			// 6th request should be rejected
			const result = await limiter.check("test-key");
			expect(result.allowed).toBe(false);
			expect(result.currentCount).toBe(5);
		});

		it("should track different keys separately", async () => {
			const result1 = await limiter.check("key1");
			const result2 = await limiter.check("key2");

			expect(result1.allowed).toBe(true);
			expect(result1.currentCount).toBe(1);
			expect(result2.allowed).toBe(true);
			expect(result2.currentCount).toBe(1);
		});

		it("should reset after window expires", async () => {
			// Make max requests
			for (let i = 0; i < 5; i++) {
				await limiter.check("test-key");
			}

			// Next request should be rejected
			let result = await limiter.check("test-key");
			expect(result.allowed).toBe(false);

			// Simulate window expiration by directly manipulating KV
			await kv.delete("test:test-key");

			// Should allow new requests
			result = await limiter.check("test-key");
			expect(result.allowed).toBe(true);
			expect(result.currentCount).toBe(1);
		});

		it("should include resetIn and resetAt in result", async () => {
			const result = await limiter.check("test-key");
			expect(result.resetIn).toBeGreaterThan(0);
			expect(result.resetAt).toBeGreaterThan(Date.now());
		});
	});

	describe("reset()", () => {
		it("should reset rate limit for a key", async () => {
			// Make max requests
			for (let i = 0; i < 5; i++) {
				await limiter.check("test-key");
			}

			// Should be at limit
			let result = await limiter.check("test-key");
			expect(result.allowed).toBe(false);

			// Reset
			await limiter.reset("test-key");

			// Should allow new requests
			result = await limiter.check("test-key");
			expect(result.allowed).toBe(true);
			expect(result.currentCount).toBe(1);
		});
	});

	describe("getStatus()", () => {
		it("should return status without incrementing count", async () => {
			// Make one request
			await limiter.check("test-key");

			// Get status multiple times
			const status1 = await limiter.getStatus("test-key");
			const status2 = await limiter.getStatus("test-key");

			expect(status1.currentCount).toBe(1);
			expect(status2.currentCount).toBe(1);
		});

		it("should return zero count for new key", async () => {
			const status = await limiter.getStatus("new-key");
			expect(status.currentCount).toBe(0);
			expect(status.allowed).toBe(true);
		});
	});
});

describe("getClientIP", () => {
	it("should extract IP from CF-Connecting-IP header", () => {
		const request = new Request("https://example.com", {
			headers: { "CF-Connecting-IP": "1.2.3.4" },
		});
		expect(getClientIP(request)).toBe("1.2.3.4");
	});

	it("should extract IP from X-Forwarded-For header", () => {
		const request = new Request("https://example.com", {
			headers: { "X-Forwarded-For": "1.2.3.4, 5.6.7.8" },
		});
		expect(getClientIP(request)).toBe("1.2.3.4");
	});

	it("should extract IP from X-Real-IP header", () => {
		const request = new Request("https://example.com", {
			headers: { "X-Real-IP": "1.2.3.4" },
		});
		expect(getClientIP(request)).toBe("1.2.3.4");
	});

	it("should prioritize CF-Connecting-IP", () => {
		const request = new Request("https://example.com", {
			headers: {
				"CF-Connecting-IP": "1.2.3.4",
				"X-Forwarded-For": "5.6.7.8",
				"X-Real-IP": "9.10.11.12",
			},
		});
		expect(getClientIP(request)).toBe("1.2.3.4");
	});

	it("should return 'unknown' if no IP headers present", () => {
		const request = new Request("https://example.com");
		expect(getClientIP(request)).toBe("unknown");
	});
});

describe("createRateLimiters", () => {
	it("should create all rate limiters", () => {
		const env = {
			OAUTH_KV: new MockKVNamespace() as any,
		} as any;

		const limiters = createRateLimiters(env);

		expect(limiters.auth).toBeDefined();
		expect(limiters.token).toBeDefined();
		expect(limiters.tool).toBeDefined();
		expect(limiters.global).toBeDefined();
	});

	it("should throw error if OAUTH_KV not configured", () => {
		const env = {} as any;

		expect(() => createRateLimiters(env)).toThrow(
			"OAUTH_KV is required for rate limiting"
		);
	});
});

describe("applyRateLimit", () => {
	let kv: MockKVNamespace;
	let limiter: RateLimiter;

	beforeEach(() => {
		kv = new MockKVNamespace();
		limiter = new RateLimiter(
			{
				maxRequests: 2,
				windowMs: 60000,
				keyPrefix: "test",
			},
			kv as any
		);
	});

	it("should return null if request is allowed", async () => {
		const response = await applyRateLimit(limiter, "test-key");
		expect(response).toBeNull();
	});

	it("should return 429 response if rate limited", async () => {
		// Make max requests
		await limiter.check("test-key");
		await limiter.check("test-key");

		// Next request should be rate limited
		const response = await applyRateLimit(limiter, "test-key");
		expect(response).not.toBeNull();
		expect(response!.status).toBe(429);
	});

	it("should include rate limit headers in 429 response", async () => {
		// Make max requests
		await limiter.check("test-key");
		await limiter.check("test-key");

		const response = await applyRateLimit(limiter, "test-key");
		expect(response!.headers.get("Retry-After")).toBeDefined();
		expect(response!.headers.get("X-RateLimit-Limit")).toBe("2");
		expect(response!.headers.get("X-RateLimit-Remaining")).toBe("0");
		expect(response!.headers.get("X-RateLimit-Reset")).toBeDefined();
	});

	it("should include error details in response body", async () => {
		// Make max requests
		await limiter.check("test-key");
		await limiter.check("test-key");

		const response = await applyRateLimit(limiter, "test-key");
		const body = await response!.json();

		expect(body.error).toBe("Rate limit exceeded");
		expect(body.message).toBe("Too many requests. Please try again later.");
		expect(body.limit).toBe(2);
		expect(body.current).toBe(2);
		expect(body.resetIn).toBeGreaterThan(0);
	});
});

describe("addRateLimitHeaders", () => {
	it("should add rate limit headers to response", async () => {
		const originalResponse = new Response("OK", {
			status: 200,
			headers: { "Content-Type": "text/plain" },
		});

		const result = {
			allowed: true,
			currentCount: 3,
			limit: 10,
			resetIn: 60,
			resetAt: Date.now() + 60000,
		};

		const response = addRateLimitHeaders(originalResponse, result);

		expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
		expect(response.headers.get("X-RateLimit-Remaining")).toBe("7");
		expect(response.headers.get("X-RateLimit-Reset")).toBeDefined();
		expect(response.headers.get("Content-Type")).toBe("text/plain");
	});

	it("should set remaining to 0 if over limit", async () => {
		const originalResponse = new Response("OK");

		const result = {
			allowed: false,
			currentCount: 12,
			limit: 10,
			resetIn: 60,
			resetAt: Date.now() + 60000,
		};

		const response = addRateLimitHeaders(originalResponse, result);
		expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
	});
});

describe("RATE_LIMIT_CONFIGS", () => {
	it("should have all required configurations", () => {
		expect(RATE_LIMIT_CONFIGS.AUTH_ENDPOINT).toBeDefined();
		expect(RATE_LIMIT_CONFIGS.TOKEN_VALIDATION).toBeDefined();
		expect(RATE_LIMIT_CONFIGS.TOOL_EXECUTION).toBeDefined();
		expect(RATE_LIMIT_CONFIGS.GLOBAL).toBeDefined();
	});

	it("should have reasonable default limits", () => {
		expect(RATE_LIMIT_CONFIGS.AUTH_ENDPOINT.maxRequests).toBeGreaterThan(0);
		expect(RATE_LIMIT_CONFIGS.AUTH_ENDPOINT.windowMs).toBeGreaterThan(0);
		expect(RATE_LIMIT_CONFIGS.TOKEN_VALIDATION.maxRequests).toBeGreaterThan(0);
		expect(RATE_LIMIT_CONFIGS.TOOL_EXECUTION.maxRequests).toBeGreaterThan(0);
	});

	it("should have unique key prefixes", () => {
		const prefixes = new Set([
			RATE_LIMIT_CONFIGS.AUTH_ENDPOINT.keyPrefix,
			RATE_LIMIT_CONFIGS.TOKEN_VALIDATION.keyPrefix,
			RATE_LIMIT_CONFIGS.TOOL_EXECUTION.keyPrefix,
			RATE_LIMIT_CONFIGS.GLOBAL.keyPrefix,
		]);
		expect(prefixes.size).toBe(4);
	});
});
