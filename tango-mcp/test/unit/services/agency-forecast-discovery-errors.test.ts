/**
 * Unit tests for AgencyForecastDiscoveryService Error Handling
 *
 * Tests comprehensive error scenarios including:
 * - Cache read/write failures
 * - API errors (timeout, network, server errors)
 * - CSV parse failures
 * - Fallback behavior
 * - Error metadata propagation
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResponse, TangoApiClient } from "@/api/tango-client";
import type { CacheManager } from "@/cache/kv-cache";
import {
	AgencyForecastDiscoveryService,
} from "@/services/agency-forecast-discovery";
import { TangoTimeoutError, TangoNetworkError, TangoApiError } from "@/types/errors";

/**
 * Mock TangoApiClient
 */
function createMockClient(): TangoApiClient {
	return {
		searchForecasts: vi.fn(),
	} as unknown as TangoApiClient;
}

/**
 * Mock CacheManager
 */
function createMockCache(): CacheManager {
	return {
		get: vi.fn(),
		set: vi.fn(),
		invalidate: vi.fn(),
	} as unknown as CacheManager;
}

/**
 * Sample CSV data for testing
 */
const SAMPLE_CSV = `id,agency,title,naics_code,modified_at
1,HHS,Health IT Modernization,541519,2024-01-15
2,DHS,Cybersecurity Services,541512,2024-01-14
3,GSA,IT Support Services,541519,2024-01-12`;

describe("AgencyForecastDiscoveryService - Error Handling", () => {
	let service: AgencyForecastDiscoveryService;
	let mockClient: TangoApiClient;
	let mockCache: CacheManager;

	beforeEach(() => {
		mockClient = createMockClient();
		mockCache = createMockCache();
		service = new AgencyForecastDiscoveryService(mockClient, mockCache);
	});

	describe("Cache Error Scenarios", () => {
		it("should handle cache read failure and continue to API", async () => {
			// Mock cache read error
			vi.mocked(mockCache.get).mockRejectedValue(
				new Error("KV namespace unavailable"),
			);

			// Mock successful API response
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: SAMPLE_CSV,
				format: "csv",
			} as ApiResponse<any>);

			vi.mocked(mockCache.set).mockResolvedValue({
				success: true,
			});

			const result = await service.discoverAgencies("test-api-key");

			// Should succeed with API data
			expect(result.source).toBe("dynamic");
			expect(result.agencies.size).toBe(3);
			expect(result.metadata?.fallback_used).toBe(false);

			// Should include cache read error in metadata
			expect(result.errors).toBeDefined();
			expect(result.errors?.length).toBeGreaterThan(0);
			expect(result.errors?.[0].code).toBe("CACHE_READ_ERROR");
		});

		it("should handle cache write failure but still return data", async () => {
			// Mock cache miss
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock successful API response
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: SAMPLE_CSV,
				format: "csv",
			} as ApiResponse<any>);

			// Mock cache write failure
			vi.mocked(mockCache.set).mockRejectedValue(
				new Error("Cache write quota exceeded"),
			);

			const result = await service.discoverAgencies("test-api-key");

			// Should succeed with API data
			expect(result.source).toBe("dynamic");
			expect(result.agencies.size).toBe(3);
			expect(result.metadata?.fallback_used).toBe(false);

			// Should include cache write error
			expect(result.errors).toBeDefined();
			const cacheWriteError = result.errors?.find(e => e.code === "CACHE_WRITE_ERROR");
			expect(cacheWriteError).toBeDefined();
			expect(cacheWriteError?.fallback_used).toBe(false);
		});
	});

	describe("API Error Scenarios", () => {
		it("should handle API timeout and use static fallback", async () => {
			// Mock cache miss
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock timeout error
			vi.mocked(mockClient.searchForecasts).mockRejectedValue(
				new TangoTimeoutError(),
			);

			const result = await service.discoverAgencies("test-api-key");

			// Should use static fallback
			expect(result.source).toBe("static_fallback");
			expect(result.agencies.size).toBeGreaterThan(0);
			expect(result.metadata?.fallback_used).toBe(true);
			expect(result.metadata?.warning).toBeDefined();

			// Should include timeout error
			expect(result.errors).toBeDefined();
			const timeoutError = result.errors?.find(e => e.code === "TIMEOUT");
			expect(timeoutError).toBeDefined();
			expect(timeoutError?.message).toContain("30 seconds");
			expect(timeoutError?.fallback_used).toBe(true);
		});

		it("should handle network error and use static fallback", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock network error
			vi.mocked(mockClient.searchForecasts).mockRejectedValue(
				new TangoNetworkError("Connection refused"),
			);

			const result = await service.discoverAgencies("test-api-key");

			// Should use static fallback
			expect(result.source).toBe("static_fallback");
			expect(result.metadata?.fallback_used).toBe(true);

			// Should include network error
			expect(result.errors).toBeDefined();
			const networkError = result.errors?.find(e => e.code === "NETWORK_ERROR");
			expect(networkError).toBeDefined();
			expect(networkError?.fallback_used).toBe(true);
		});

		it("should handle API error (500) and use static fallback", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock API returning error response
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: false,
				error: "Internal server error",
				status: 500,
			} as ApiResponse<any>);

			const result = await service.discoverAgencies("test-api-key");

			// Should use static fallback
			expect(result.source).toBe("static_fallback");
			expect(result.metadata?.fallback_used).toBe(true);

			// Should include API error with status code
			expect(result.errors).toBeDefined();
			const apiError = result.errors?.find(e => e.code === "API_ERROR");
			expect(apiError).toBeDefined();
			expect(apiError?.context?.status).toBe(500);
			expect(apiError?.fallback_used).toBe(true);
		});

		it("should handle rate limit (429) and use static fallback", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock rate limit error
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: false,
				error: "Rate limit exceeded",
				status: 429,
			} as ApiResponse<any>);

			const result = await service.discoverAgencies("test-api-key");

			// Should use static fallback
			expect(result.source).toBe("static_fallback");
			expect(result.metadata?.fallback_used).toBe(true);

			// Should include API error
			const apiError = result.errors?.[0];
			expect(apiError?.code).toBe("API_ERROR");
			expect(apiError?.context?.status).toBe(429);
		});
	});

	describe("CSV Parse Error Scenarios", () => {
		it("should handle empty CSV and use static fallback", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock API returning empty CSV (header only)
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: "id,agency,title\n",
				format: "csv",
			} as ApiResponse<any>);

			const result = await service.discoverAgencies("test-api-key");

			// Should use static fallback
			expect(result.source).toBe("static_fallback");
			expect(result.metadata?.fallback_used).toBe(true);

			// Should include parse error
			expect(result.errors).toBeDefined();
			const parseError = result.errors?.find(e => e.code === "PARSE_ERROR");
			expect(parseError).toBeDefined();
			expect(parseError?.message).toContain("parse");
		});

		it("should handle malformed CSV and use static fallback", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock API returning invalid CSV
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: "not valid csv data at all!!!",
				format: "csv",
			} as ApiResponse<any>);

			const result = await service.discoverAgencies("test-api-key");

			// Should use static fallback
			expect(result.source).toBe("static_fallback");
			expect(result.metadata?.fallback_used).toBe(true);

			// Should include parse error
			expect(result.errors).toBeDefined();
			const parseError = result.errors?.find(e => e.code === "PARSE_ERROR");
			expect(parseError).toBeDefined();
		});
	});

	describe("Static Fallback Behavior", () => {
		it("should return known agencies when using static fallback", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock API failure
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: false,
				error: "Service unavailable",
				status: 503,
			} as ApiResponse<any>);

			const result = await service.discoverAgencies("test-api-key");

			// Should use static fallback
			expect(result.source).toBe("static_fallback");
			expect(result.metadata?.fallback_used).toBe(true);

			// Should include known agencies (at least HHS, DHS, GSA)
			expect(result.agencies.has("HHS")).toBe(true);
			expect(result.agencies.has("DHS")).toBe(true);
			expect(result.agencies.has("GSA")).toBe(true);

			// Should include metadata
			expect(result.metadata?.count).toBe(result.agencies.size);
			expect(result.metadata?.static_updated).toBeDefined();
			expect(result.metadata?.warning).toContain("static fallback");
		});

		it("should include timestamp in error metadata", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			vi.mocked(mockClient.searchForecasts).mockRejectedValue(
				new Error("Network failure"),
			);

			const result = await service.discoverAgencies("test-api-key");

			// Check error has timestamp
			expect(result.errors).toBeDefined();
			expect(result.errors?.[0].timestamp).toBeDefined();

			// Timestamp should be valid ISO 8601
			const timestamp = result.errors?.[0].timestamp;
			expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		it("should accumulate multiple errors in cascade", async () => {
			// Mock cache read failure
			vi.mocked(mockCache.get).mockRejectedValue(
				new Error("Cache unavailable"),
			);

			// Mock API failure
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: false,
				error: "API timeout",
				status: 504,
			} as ApiResponse<any>);

			const result = await service.discoverAgencies("test-api-key");

			// Should use static fallback
			expect(result.source).toBe("static_fallback");
			expect(result.metadata?.fallback_used).toBe(true);

			// Should include both errors
			expect(result.errors).toBeDefined();
			expect(result.errors?.length).toBeGreaterThanOrEqual(2);

			// Should have cache read error
			const cacheError = result.errors?.find(e => e.code === "CACHE_READ_ERROR");
			expect(cacheError).toBeDefined();

			// Should have API error
			const apiError = result.errors?.find(e => e.code === "API_ERROR");
			expect(apiError).toBeDefined();
		});
	});

	describe("Error Metadata Structure", () => {
		it("should include all required fields in DiscoveryError", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			vi.mocked(mockClient.searchForecasts).mockRejectedValue(
				new TangoTimeoutError(),
			);

			const result = await service.discoverAgencies("test-api-key");

			expect(result.errors).toBeDefined();
			const error = result.errors?.[0];

			// Required fields
			expect(error?.code).toBeDefined();
			expect(error?.message).toBeDefined();
			expect(error?.fallback_used).toBeDefined();
			expect(error?.timestamp).toBeDefined();

			// Context is optional but should be present for this error
			expect(error?.context).toBeDefined();
			expect(error?.context?.operation).toBeDefined();
		});

		it("should mark fallback_used correctly", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock cache write failure (doesn't trigger fallback)
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: SAMPLE_CSV,
				format: "csv",
			} as ApiResponse<any>);

			vi.mocked(mockCache.set).mockRejectedValue(
				new Error("Cache write failed"),
			);

			const result = await service.discoverAgencies("test-api-key");

			// Dynamic succeeded, no fallback
			expect(result.source).toBe("dynamic");
			expect(result.metadata?.fallback_used).toBe(false);

			// Cache write error should mark fallback_used = false
			const cacheWriteError = result.errors?.find(e => e.code === "CACHE_WRITE_ERROR");
			expect(cacheWriteError?.fallback_used).toBe(false);

			// Now test with fallback triggered
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: false,
				error: "Service down",
				status: 503,
			} as ApiResponse<any>);

			const fallbackResult = await service.discoverAgencies("test-api-key");

			// Fallback used
			expect(fallbackResult.source).toBe("static_fallback");
			expect(fallbackResult.metadata?.fallback_used).toBe(true);

			// API error should mark fallback_used = true
			const apiError = fallbackResult.errors?.find(e => e.code === "API_ERROR");
			expect(apiError?.fallback_used).toBe(true);
		});
	});

	describe("Success Cases with No Errors", () => {
		it("should not include errors field when everything succeeds", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: SAMPLE_CSV,
				format: "csv",
			} as ApiResponse<any>);

			vi.mocked(mockCache.set).mockResolvedValue({
				success: true,
			});

			const result = await service.discoverAgencies("test-api-key");

			// Should succeed
			expect(result.source).toBe("dynamic");
			expect(result.agencies.size).toBe(3);

			// Should NOT include errors field
			expect(result.errors).toBeUndefined();
		});

		it("should not include errors field for cache hits", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: true,
				data: ["HHS", "DHS", "GSA"],
			});

			const result = await service.discoverAgencies("test-api-key");

			// Should succeed from cache
			expect(result.source).toBe("cache");
			expect(result.cached).toBe(true);

			// Should NOT include errors field
			expect(result.errors).toBeUndefined();
		});
	});
});
