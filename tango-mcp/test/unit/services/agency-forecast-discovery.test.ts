/**
 * Unit tests for AgencyForecastDiscoveryService
 *
 * Tests:
 * - CSV parsing and agency extraction
 * - Cache hit/miss behavior
 * - Error handling and graceful degradation
 * - CSV row counting
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResponse, TangoApiClient } from "@/api/tango-client";
import type { CacheManager } from "@/cache/kv-cache";
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
 * Sample CSV data for testing
 */
const SAMPLE_CSV = `id,agency,title,naics_code,modified_at
1,HHS,Health IT Modernization,541519,2024-01-15
2,DHS,Cybersecurity Services,541512,2024-01-14
3,HHS,Medical Supplies,339113,2024-01-13
4,GSA,IT Support Services,541519,2024-01-12
5,DHS,Border Security Tech,334511,2024-01-11`;

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
			expect(result.agencies.size).toBe(3);
			expect(result.agencies.has("HHS")).toBe(true);
			expect(result.agencies.has("DHS")).toBe(true);
			expect(result.agencies.has("GSA")).toBe(true);
			expect(mockClient.searchForecasts).not.toHaveBeenCalled();
		});

		it("should sample CSV when cache misses", async () => {
			// Mock cache miss
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock successful CSV response
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: SAMPLE_CSV,
				format: "csv",
			} as ApiResponse<any>);

			// Mock cache set
			vi.mocked(mockCache.set).mockResolvedValue({
				success: true,
			});

			const result = await service.discoverAgencies("test-api-key");

			expect(result.cached).toBe(false);
			expect(result.sampled).toBe(5);
			expect(result.agencies.size).toBe(3);
			expect(result.agencies.has("HHS")).toBe(true);
			expect(result.agencies.has("DHS")).toBe(true);
			expect(result.agencies.has("GSA")).toBe(true);

			// Verify API was called with correct parameters
			expect(mockClient.searchForecasts).toHaveBeenCalledWith(
				{
					format: "csv",
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

		it("should handle API errors gracefully", async () => {
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
			expect(result.agencies.size).toBe(0);
			expect(result.error).toBe("API timeout");
			expect(mockCache.set).not.toHaveBeenCalled();
		});

		it("should handle cache read failures gracefully", async () => {
			// Mock cache error
			vi.mocked(mockCache.get).mockRejectedValue(
				new Error("Cache unavailable"),
			);

			// Mock successful CSV response
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: SAMPLE_CSV,
				format: "csv",
			} as ApiResponse<any>);

			vi.mocked(mockCache.set).mockResolvedValue({
				success: true,
			});

			// Should fall back to API call despite cache error
			const result = await service.discoverAgencies("test-api-key");

			expect(result.cached).toBe(false);
			expect(result.agencies.size).toBe(3);
			expect(mockClient.searchForecasts).toHaveBeenCalled();
		});

		it("should handle cache write failures gracefully", async () => {
			// Mock cache miss
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock successful CSV response
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: SAMPLE_CSV,
				format: "csv",
			} as ApiResponse<any>);

			// Mock cache write failure
			vi.mocked(mockCache.set).mockRejectedValue(
				new Error("Cache write failed"),
			);

			// Should still return results despite cache write failure
			const result = await service.discoverAgencies("test-api-key");

			expect(result.cached).toBe(false);
			expect(result.agencies.size).toBe(3);
			expect(result.error).toBeUndefined();
		});

		it("should handle unexpected errors gracefully", async () => {
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
			expect(result.agencies.size).toBe(0);
			expect(result.error).toBe("Error: Unexpected network error");
		});

		it("should work without cache manager", async () => {
			// Create service without cache
			const serviceNoCache = new AgencyForecastDiscoveryService(mockClient);

			// Mock successful CSV response
			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: SAMPLE_CSV,
				format: "csv",
			} as ApiResponse<any>);

			const result = await serviceNoCache.discoverAgencies("test-api-key");

			expect(result.cached).toBe(false);
			expect(result.agencies.size).toBe(3);
			expect(mockClient.searchForecasts).toHaveBeenCalled();
		});
	});

	describe("CSV parsing", () => {
		it("should extract unique agency codes from CSV", async () => {
			// Mock cache miss
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Mock CSV with duplicate agencies
			const csvWithDuplicates = `id,agency,title
1,HHS,Forecast 1
2,HHS,Forecast 2
3,DHS,Forecast 3
4,HHS,Forecast 4`;

			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: csvWithDuplicates,
				format: "csv",
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

		it("should handle empty CSV gracefully", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// Empty CSV (only header)
			const emptyCSV = "id,agency,title\n";

			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: emptyCSV,
				format: "csv",
			} as ApiResponse<any>);

			const result = await service.discoverAgencies("test-api-key");

			expect(result.agencies.size).toBe(0);
			expect(result.sampled).toBe(0);
			// Should not cache empty results
			expect(mockCache.set).not.toHaveBeenCalled();
		});

		it("should handle CSV with missing agency values", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// CSV with some missing agency values
			const csvWithMissing = `id,agency,title
1,HHS,Forecast 1
2,,Forecast 2
3,DHS,Forecast 3
4,,Forecast 4`;

			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: csvWithMissing,
				format: "csv",
			} as ApiResponse<any>);

			vi.mocked(mockCache.set).mockResolvedValue({
				success: true,
			});

			const result = await service.discoverAgencies("test-api-key");

			// Should only include rows with agency values
			expect(result.agencies.size).toBe(2);
			expect(result.agencies.has("HHS")).toBe(true);
			expect(result.agencies.has("DHS")).toBe(true);
		});

		it("should trim whitespace from agency codes", async () => {
			vi.mocked(mockCache.get).mockResolvedValue({
				success: true,
				hit: false,
			});

			// CSV with whitespace around agency codes
			const csvWithWhitespace = `id,agency,title
1," HHS ",Forecast 1
2,"  DHS",Forecast 2
3,"GSA  ",Forecast 3`;

			vi.mocked(mockClient.searchForecasts).mockResolvedValue({
				success: true,
				data: csvWithWhitespace,
				format: "csv",
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
