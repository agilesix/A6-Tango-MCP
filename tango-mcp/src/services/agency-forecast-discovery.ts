/**
 * Agency Forecast Discovery Service
 *
 * Discovers which agencies have forecasts by sampling the forecast CSV API.
 * Uses KV caching with 24-hour TTL to minimize API calls.
 *
 * Philosophy:
 * - Transparent: Uses simple CSV sampling, no magic
 * - Honest: Returns only what we actually observe in the data
 * - No guessing: Empty Map if discovery fails, never invent data
 *
 * Implementation:
 * - Query: GET /api/forecasts/?format=csv&limit=100&ordering=-modified_at
 * - Cache key: 'agency_forecast_availability:discovered'
 * - TTL: 86400 seconds (24 hours)
 * - Error handling: Graceful degradation, never throw
 */

import type { TangoApiClient } from "@/api/tango-client";
import type { CacheManager } from "@/cache/kv-cache";
import { parseCSV } from "@/utils/csv-parser";

/**
 * Cache configuration for agency forecast discovery
 */
const CACHE_KEY = "agency_forecast_availability:discovered";
const CACHE_TTL_SECONDS = 86400; // 24 hours

/**
 * CSV sampling configuration
 */
const SAMPLE_LIMIT = 100;
const SAMPLE_ORDERING = "-modified_at"; // Most recently modified first

/**
 * Result of agency forecast discovery
 */
export interface AgencyForecastDiscoveryResult {
	/** Map of agency codes to whether they have forecasts */
	agencies: Map<string, boolean>;
	/** Whether this result came from cache */
	cached: boolean;
	/** Number of forecasts sampled (0 if from cache) */
	sampled?: number;
	/** Error message if discovery failed */
	error?: string;
}

/**
 * Agency Forecast Discovery Service
 *
 * Discovers which agencies have forecasts by sampling recent forecast data.
 * Caches results for 24 hours to minimize API load.
 */
export class AgencyForecastDiscoveryService {
	constructor(
		private readonly client: TangoApiClient,
		private readonly cache?: CacheManager,
	) {}

	/**
	 * Discover which agencies have forecasts
	 *
	 * Attempts to use cached data first, then falls back to CSV sampling.
	 * Never throws - always returns a result (possibly empty).
	 *
	 * @param apiKey Tango API key for authentication
	 * @returns Discovery result with agency availability map
	 *
	 * @example
	 * ```typescript
	 * const discovery = new AgencyForecastDiscoveryService(client, cache);
	 * const result = await discovery.discoverAgencies("api-key");
	 *
	 * if (result.agencies.has("HHS")) {
	 *   console.log("HHS has forecasts");
	 * }
	 * ```
	 */
	async discoverAgencies(
		apiKey: string,
	): Promise<AgencyForecastDiscoveryResult> {
		// Try cache first
		if (this.cache) {
			try {
				const cached = await this.cache.get<string[]>(CACHE_KEY);
				if (cached.hit && cached.data) {
					// Convert array back to Map
					const agencies = new Map<string, boolean>();
					for (const code of cached.data) {
						agencies.set(code, true);
					}

					return {
						agencies,
						cached: true,
					};
				}
			} catch (error) {
				// Log but continue - cache failures shouldn't block discovery
				console.warn("Cache read failed during agency forecast discovery:", {
					error: String(error),
				});
			}
		}

		// Perform CSV sampling
		return await this.sampleForecasts(apiKey);
	}

	/**
	 * Sample forecasts from CSV API to discover agencies
	 *
	 * Queries the most recent 100 forecasts and extracts unique agency codes.
	 * Caches the result for 24 hours.
	 *
	 * @param apiKey Tango API key for authentication
	 * @returns Discovery result with sampled agencies
	 */
	private async sampleForecasts(
		apiKey: string,
	): Promise<AgencyForecastDiscoveryResult> {
		try {
			// Query forecast CSV
			const response = await this.client.searchForecasts(
				{
					format: "csv",
					limit: SAMPLE_LIMIT,
					ordering: SAMPLE_ORDERING,
				},
				apiKey,
			);

			// Check for API errors
			if (!response.success || !response.data) {
				console.error("Forecast CSV query failed:", {
					error: response.error,
					status: response.status,
				});

				return {
					agencies: new Map(),
					cached: false,
					error: response.error || "API request failed",
				};
			}

			// Parse CSV to extract agency codes
			const csvData = response.data as unknown as string;
			const agencies = this.extractAgenciesFromCSV(csvData);

			// Cache the result (as array for JSON serialization)
			if (this.cache && agencies.size > 0) {
				try {
					const agencyCodes = Array.from(agencies.keys());
					await this.cache.set(CACHE_KEY, agencyCodes, CACHE_TTL_SECONDS);
				} catch (error) {
					// Log but don't fail - cache write failures shouldn't break discovery
					console.warn("Cache write failed during agency forecast discovery:", {
						error: String(error),
					});
				}
			}

			return {
				agencies,
				cached: false,
				sampled: this.countCSVRows(csvData),
			};
		} catch (error) {
			// Catch any unexpected errors
			console.error("Unexpected error during agency forecast discovery:", {
				error: String(error),
			});

			return {
				agencies: new Map(),
				cached: false,
				error: String(error),
			};
		}
	}

	/**
	 * Extract unique agency codes from CSV data
	 *
	 * Parses CSV and collects all unique values from the 'agency' column.
	 *
	 * @param csvData Raw CSV string
	 * @returns Map of agency codes (all set to true)
	 */
	private extractAgenciesFromCSV(csvData: string): Map<string, boolean> {
		const agencies = new Map<string, boolean>();

		try {
			// Parse CSV into structured data
			const rows = parseCSV(csvData);

			// Extract unique agency codes
			for (const row of rows) {
				const agencyCode = row.agency?.trim();
				if (agencyCode && agencyCode.length > 0) {
					agencies.set(agencyCode, true);
				}
			}
		} catch (error) {
			console.error("CSV parsing failed during agency extraction:", {
				error: String(error),
			});
		}

		return agencies;
	}

	/**
	 * Count number of data rows in CSV (excluding header)
	 *
	 * @param csvData Raw CSV string
	 * @returns Number of data rows
	 */
	private countCSVRows(csvData: string): number {
		try {
			const lines = csvData.trim().split("\n");
			// Subtract 1 for header, filter empty lines
			return lines.slice(1).filter((line) => line.trim().length > 0).length;
		} catch {
			return 0;
		}
	}

	/**
	 * Clear cached agency discovery data
	 *
	 * Useful for forcing a fresh discovery or during testing.
	 *
	 * @returns True if cache was cleared successfully
	 */
	async clearCache(): Promise<boolean> {
		if (!this.cache) {
			return false;
		}

		try {
			const result = await this.cache.invalidate(CACHE_KEY);
			return result.success;
		} catch (error) {
			console.error("Failed to clear agency forecast discovery cache:", {
				error: String(error),
			});
			return false;
		}
	}
}

/**
 * Create an AgencyForecastDiscoveryService instance
 *
 * @param client TangoApiClient for API queries
 * @param cache Optional CacheManager for caching results
 * @returns Service instance
 */
export function createAgencyForecastDiscoveryService(
	client: TangoApiClient,
	cache?: CacheManager,
): AgencyForecastDiscoveryService {
	return new AgencyForecastDiscoveryService(client, cache);
}
