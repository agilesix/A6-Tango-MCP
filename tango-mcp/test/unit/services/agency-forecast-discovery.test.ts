/**
 * Unit tests for AgencyForecastDiscoveryService
 *
 * Tests:
 * - JSON parsing and agency extraction
 * - Cache hit/miss behavior
 * - Error handling and graceful degradation
 * - JSON response handling
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResponse, TangoApiClient } from "@/api/tango-client";
import type { CacheManager } from "@/cache/kv-cache";
import type { TangoForecastListResponse } from "@/types/tango-api";
import {
	AgencyForecastDiscoveryService,
	createAgencyForecastDiscoveryService,
} from "@/services/agency-forecast-discovery";

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
 * Sample JSON data for testing
 */
const SAMPLE_JSON: TangoForecastListResponse = {
	results: [
		{ id: 1, agency: "HHS", title: "Health IT Modernization", naics_code: "541519" },
		{ id: 2, agency: "DHS", title: "Cybersecurity Services", naics_code: "541512" },
		{ id: 3, agency: "HHS", title: "Medical Supplies", naics_code: "339113" },
		{ id: 4, agency: "GSA", title: "IT Support Services", naics_code: "541519" },
		{ id: 5, agency: "DHS", title: "Border Security Tech", naics_code: "334511" },
	],
	count: 5,
	total: 5,
};

describe("AgencyForecastDiscoveryService", () => {
	let service: AgencyForecastDiscoveryService;
	let mockClient: TangoApiClient;
	let mockCache: CacheManager;

	beforeEach(() => {
		mockClient = createMockClient();
		mockCache = createMockCache();
		service = new AgencyForecastDiscoveryService(mockClient, mockCache);
	});

	describe("discoverAgencies", () => {
		it("should return cached agencies if available", async () => {
			// Mock cache hit
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: true,
				data: ["HHS", "DHS", "GSA"],
			});

			const result = await service.discoverAgencies("test-api-key");

			expect(result.cached).toBe(true);
			expect(result.source).toBe("cache");
			expect(result.agencies.size).toBe(3);
			expect(result.agencies.has("HHS")).toBe(true);
			expect(result.agencies.has("DHS")).toBe(true);
			expect(result.agencies.has("GSA")).toBe(true);
			expect(mockClient.searchForecasts).not.toHaveBeenCalled();
		});

		it("should sample JSON when cache misses", async () => {
			// Mock cache miss
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock successful JSON response
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: SAMPLE_JSON,
				format: "json",
			} as ApiResponse<any>);

			// Mock cache set
			vi.mocked(mockCache.set).mockResolvedValue({
				success: true,
			});

			const result = await service.discoverAgencies("test-api-key");

			expect(result.cached).toBe(false);
			expect(result.source).toBe("dynamic");
			expect(result.sampled).toBe(5);
			expect(result.agencies.size).toBe(3);
			expect(result.agencies.has("HHS")).toBe(true);
			expect(result.agencies.has("DHS")).toBe(true);
			expect(result.agencies.has("GSA")).toBe(true);

			// Verify API was called with correct parameters (no format parameter for JSON)
			expect(mockClient.searchForecasts).toHaveBeenCalledWith(
				{
					limit: 100,
					ordering: "-modified_at",
				},
				"test-api-key",
			);

			// Verify cache was updated
			expect(mockCache.set).toHaveBeenCalledWith(
				"agency_forecast_availability:discovered",
				["HHS", "DHS", "GSA"],
				86400,
			);
		});

		it("should fall back to static list when API errors occur", async () => {
			// Mock cache miss
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock API error
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: false,
				error: "API timeout",
				status: 504,
			} as ApiResponse<any>);

			const result = await service.discoverAgencies("test-api-key");

			expect(result.cached).toBe(false);
			expect(result.source).toBe("static_fallback");
			expect(result.agencies.size).toBeGreaterThan(0);
			expect(result.errors).toBeDefined();
			expect(result.errors?.length).toBeGreaterThan(0);
			// Should include known agencies from static list
			expect(result.agencies.has("HHS")).toBe(true);
			expect(result.agencies.has("DHS")).toBe(true);
			expect(mockCache.set).not.toHaveBeenCalled();
		});

		it("should handle cache read failures gracefully", async () => {
			// Mock cache error
			vi.mocked(mockCache.get).mockRejectedValue(
				new Error("Cache unavailable"),
			);

			// Mock successful JSON response
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: SAMPLE_JSON,
				format: "json",
			} as ApiResponse<any>);

			vi.mocked(mockCache.set).mockResolvedValue({
				success: true,
			});

			// Should fall back to API call despite cache error
			const result = await service.discoverAgencies("test-api-key");

			expect(result.cached).toBe(false);
			expect(result.source).toBe("dynamic");
			expect(result.agencies.size).toBe(3);
			expect(mockClient.searchForecasts).toHaveBeenCalled();
		});

		it("should handle cache write failures gracefully", async () => {
			// Mock cache miss
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock successful JSON response
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: SAMPLE_JSON,
				format: "json",
			} as ApiResponse<any>);

			// Mock cache write failure
			vi.mocked(mockCache.set).mockRejectedValue(
				new Error("Cache write failed"),
			);

			// Should still return results despite cache write failure
			const result = await service.discoverAgencies("test-api-key");

			expect(result.cached).toBe(false);
			expect(result.source).toBe("dynamic");
			expect(result.agencies.size).toBe(3);
			// Cache write errors are logged but may not be in the errors array
			// since they don't block the operation
		});

		it("should fall back to static list on unexpected errors", async () => {
			// Mock cache miss
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock unexpected error
			vi.mocked(mockClient.searchForecasts).mockRejectedValue(
				new Error("Unexpected network error"),
			);

			const result = await service.discoverAgencies("test-api-key");

			expect(result.cached).toBe(false);
			expect(result.source).toBe("static_fallback");
			expect(result.agencies.size).toBeGreaterThan(0);
			expect(result.errors).toBeDefined();
			expect(result.errors?.length).toBeGreaterThan(0);
			// Should include known agencies from static list
			expect(result.agencies.has("HHS")).toBe(true);
		});

		it("should work without cache manager", async () => {
			// Create service without cache
			const serviceNoCache = new AgencyForecastDiscoveryService(mockClient);

			// Mock successful JSON response
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: SAMPLE_JSON,
				format: "json",
			} as ApiResponse<any>);

			const result = await serviceNoCache.discoverAgencies("test-api-key");

			expect(result.cached).toBe(false);
			expect(result.source).toBe("dynamic");
			expect(result.agencies.size).toBe(3);
			expect(mockClient.searchForecasts).toHaveBeenCalled();
		});

		it("should prefer dynamic data over static fallback when available", async () => {
			// Mock cache miss
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock successful JSON response
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: SAMPLE_JSON,
				format: "json",
			} as ApiResponse<any>);

			vi.mocked(mockCache.set).mockResolvedValue({
				success: true,
			});

			const result = await service.discoverAgencies("test-api-key");

			// Should use dynamic data, not static fallback
			expect(result.source).toBe("dynamic");
			expect(result.agencies.size).toBe(3);
		});

		it("should use static fallback when JSON returns empty results", async () => {
			// Mock cache miss
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock empty JSON response
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: { results: [], count: 0, total: 0 },
				format: "json",
			} as ApiResponse<any>);

			const result = await service.discoverAgencies("test-api-key");

			// Should fall back to static list
			expect(result.source).toBe("static_fallback");
			expect(result.agencies.size).toBeGreaterThan(0);
			expect(result.agencies.has("HHS")).toBe(true);
			expect(result.agencies.has("DHS")).toBe(true);
		});

		it("should correctly indicate source as cache when data is cached", async () => {
			// Mock cache hit
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: true,
				data: ["HHS", "DHS"],
			});

			const result = await service.discoverAgencies("test-api-key");

			expect(result.source).toBe("cache");
			expect(result.cached).toBe(true);
		});
	});

	describe("JSON parsing", () => {
		it("should extract unique agency codes from JSON", async () => {
			// Mock cache miss
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock JSON with duplicate agencies
			const jsonWithDuplicates: TangoForecastListResponse = {
				results: [
					{ id: 1, agency: "HHS", title: "Forecast 1" },
					{ id: 2, agency: "HHS", title: "Forecast 2" },
					{ id: 3, agency: "DHS", title: "Forecast 3" },
					{ id: 4, agency: "HHS", title: "Forecast 4" },
				],
				count: 4,
				total: 4,
			};

			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: jsonWithDuplicates,
				format: "json",
			} as ApiResponse<any>);

			vi.mocked(mockCache.set).mockResolvedValue({
				success: true,
			});

			const result = await service.discoverAgencies("test-api-key");

			// Should only have 2 unique agencies
			expect(result.agencies.size).toBe(2);
			expect(result.agencies.has("HHS")).toBe(true);
			expect(result.agencies.has("DHS")).toBe(true);

			// Cache should only store unique codes
			expect(mockCache.set).toHaveBeenCalledWith(
				expect.any(String),
				expect.arrayContaining(["HHS", "DHS"]),
				expect.any(Number),
			);
		});

		it("should handle empty JSON gracefully", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Empty JSON response
			const emptyJSON: TangoForecastListResponse = {
				results: [],
				count: 0,
				total: 0,
			};

			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: emptyJSON,
				format: "json",
			} as ApiResponse<any>);

			const result = await service.discoverAgencies("test-api-key");

			// Should fall back to static list when JSON is empty
			expect(result.source).toBe("static_fallback");
			expect(result.agencies.size).toBeGreaterThan(0);
			// Should not cache empty results
			expect(mockCache.set).not.toHaveBeenCalled();
		});

		it("should handle JSON with missing agency values", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// JSON with some missing agency values
			const jsonWithMissing: TangoForecastListResponse = {
				results: [
					{ id: 1, agency: "HHS", title: "Forecast 1" },
					{ id: 2, title: "Forecast 2" }, // Missing agency
					{ id: 3, agency: "DHS", title: "Forecast 3" },
					{ id: 4, title: "Forecast 4" }, // Missing agency
				],
				count: 4,
				total: 4,
			};

			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: jsonWithMissing,
				format: "json",
			} as ApiResponse<any>);

			vi.mocked(mockCache.set).mockResolvedValue({
				success: true,
			});

			const result = await service.discoverAgencies("test-api-key");

			// Should only include results with agency values
			expect(result.agencies.size).toBe(2);
			expect(result.agencies.has("HHS")).toBe(true);
			expect(result.agencies.has("DHS")).toBe(true);
		});

		it("should trim whitespace from agency codes", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// JSON with whitespace around agency codes
			const jsonWithWhitespace: TangoForecastListResponse = {
				results: [
					{ id: 1, agency: " HHS ", title: "Forecast 1" },
					{ id: 2, agency: "  DHS", title: "Forecast 2" },
					{ id: 3, agency: "GSA  ", title: "Forecast 3" },
				],
				count: 3,
				total: 3,
			};

			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: jsonWithWhitespace,
				format: "json",
			} as ApiResponse<any>);

			vi.mocked(mockCache.set).mockResolvedValue({
				success: true,
			});

			const result = await service.discoverAgencies("test-api-key");

			expect(result.agencies.size).toBe(3);
			expect(result.agencies.has("HHS")).toBe(true);
			expect(result.agencies.has("DHS")).toBe(true);
			expect(result.agencies.has("GSA")).toBe(true);
		});
	});

	describe("clearCache", () => {
		it("should clear cache successfully", async () => {
			vi.mocked(mockCache.invalidate).mockResolvedValue({
				success: true,
			});

			const result = await service.clearCache();

			expect(result).toBe(true);
			expect(mockCache.invalidate).toHaveBeenCalledWith(
				"agency_forecast_availability:discovered",
			);
		});

		it("should handle cache invalidation errors", async () => {
			vi.mocked(mockCache.invalidate).mockRejectedValue(
				new Error("Invalidation failed"),
			);

			const result = await service.clearCache();

			expect(result).toBe(false);
		});

		it("should return false when no cache manager", async () => {
			const serviceNoCache = new AgencyForecastDiscoveryService(mockClient);

			const result = await serviceNoCache.clearCache();

			expect(result).toBe(false);
		});
	});

	describe("createAgencyForecastDiscoveryService", () => {
		it("should create service instance", () => {
			const service = createAgencyForecastDiscoveryService(
				mockClient,
				mockCache,
			);

			expect(service).toBeInstanceOf(AgencyForecastDiscoveryService);
		});

		it("should create service without cache", () => {
			const service = createAgencyForecastDiscoveryService(mockClient);

			expect(service).toBeInstanceOf(AgencyForecastDiscoveryService);
		});
	});
});
