/**
 * Agency Forecast Discovery Service
 *
 * Discovers which agencies have forecasts by sampling the forecast JSON API.
 * Uses KV caching with 24-hour TTL to minimize API calls.
 *
 * Philosophy:
 * - Transparent: Clear error messages, never hide failures
 * - Honest: Returns only what we actually observe in the data
 * - Resilient: Always returns useful data via static fallback
 *
 * Error Handling Strategy:
 * - Cache failures → Continue to API, log warning
 * - API failures → Use static fallback, return error metadata
 * - Parse failures → Use static fallback, return partial results
 * - Network timeouts → Use static fallback, clear error message
 *
 * Implementation:
 * - Query: GET /api/forecasts/?limit=100&ordering=-modified_at
 * - Format: JSON (CSV format not supported by /forecasts/ endpoint)
 * - Cache key: 'agency_forecast_availability:discovered'
 * - TTL: 86400 seconds (24 hours)
 * - Error handling: Graceful degradation, never throw
 */

import type { TangoApiClient } from "@/api/tango-client";
import type { CacheManager } from "@/cache/kv-cache";
import type { TangoForecastListResponse } from "@/types/tango-api";
import { getKnownAgencyCodes, KNOWN_AGENCIES_WITH_FORECASTS } from "@/data/agencies-with-forecasts";
import { createDiscoveryError, type DiscoveryError } from "@/types/errors";

/**
 * Cache configuration for agency forecast discovery
 */
const CACHE_KEY = "agency_forecast_availability:discovered";
const CACHE_TTL_SECONDS = 86400; // 24 hours

/**
 * Cache configuration for agency abbreviation mapping
 */
const MAPPING_CACHE_KEY = "agency_abbreviation_mapping";
const MAPPING_CACHE_TTL_SECONDS = 86400; // 24 hours, same as discovery

/**
 * JSON sampling configuration
 */
const SAMPLE_LIMIT = 100;
const SAMPLE_ORDERING = "-modified_at"; // Most recently modified first

/**
 * Data source for agency discovery results
 */
export type DiscoverySource = "dynamic" | "static_fallback" | "cache";

/**
 * Result of agency forecast discovery
 */
export interface AgencyForecastDiscoveryResult {
	/** Map of agency codes to whether they have forecasts */
	agencies: Map<string, boolean>;
	/** Whether this result came from cache */
	cached: boolean;
	/** Data source: dynamic CSV sampling, static fallback, or cache */
	source: DiscoverySource;
	/** Number of forecasts sampled (0 if from cache or static fallback) */
	sampled?: number;
	/** Structured error information (never blocks operation) */
	errors?: DiscoveryError[];
	/** Source metadata for transparency */
	metadata?: {
		/** Number of agencies in result */
		count: number;
		/** Whether static fallback was used */
		fallback_used: boolean;
		/** Date when static data was last updated (if fallback used) */
		static_updated?: string;
		/** Warning for LLM agents */
		warning?: string;
		/** Number of abbreviations resolved to codes */
		abbreviations_resolved?: number;
		/** Whether abbreviation mapping was cached */
		mapping_cached?: boolean;
		/** Number of abbreviations that failed to resolve */
		abbreviations_unresolved?: number;
	};
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
	 * Strategy (in order):
	 * 1. Try cache first (fastest, lowest cost)
	 * 2. Attempt dynamic CSV sampling (accurate, 1 API call)
	 * 3. Fall back to static list (reliable, no API calls)
	 *
	 * Never throws - always returns a result (possibly from fallback).
	 * All errors are captured in the errors array for transparency.
	 *
	 * @param apiKey Tango API key for authentication
	 * @returns Discovery result with agency availability map and source indicator
	 *
	 * @example
	 * ```typescript
	 * const discovery = new AgencyForecastDiscoveryService(client, cache);
	 * const result = await discovery.discoverAgencies("api-key");
	 *
	 * if (result.agencies.has("HHS")) {
	 *   console.log("HHS has forecasts");
	 *   console.log("Source:", result.source); // 'cache', 'dynamic', or 'static_fallback'
	 * }
	 *
	 * // Check for errors (never throw, always in metadata)
	 * if (result.errors && result.errors.length > 0) {
	 *   console.warn("Discovery encountered issues:", result.errors);
	 * }
	 * ```
	 */
	async discoverAgencies(
		apiKey: string,
	): Promise<AgencyForecastDiscoveryResult> {
		const errors: DiscoveryError[] = [];

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
						source: "cache",
						metadata: {
							count: agencies.size,
							fallback_used: false,
						},
					};
				}
			} catch (error) {
				// Log and record cache error, but continue
				console.warn("Cache read failed during agency forecast discovery:", {
					error: String(error),
				});

				const cacheError = createDiscoveryError(
					error,
					"cache_read",
					false
				);
				// Override code for cache-specific error
				cacheError.code = 'CACHE_READ_ERROR';
				errors.push(cacheError);
			}
		}

		// Attempt dynamic CSV sampling
		const samplingResult = await this.sampleForecasts(apiKey);

		// If sampling succeeded, return it (possibly with cache errors)
		if (samplingResult.agencies.size > 0) {
			// Merge any cache errors with sampling errors
			const allErrors = [...errors, ...(samplingResult.errors || [])];
			return {
				...samplingResult,
				errors: allErrors.length > 0 ? allErrors : undefined,
				// Merge metadata from sampling result with any additional fields
				metadata: {
					count: samplingResult.agencies.size,
					fallback_used: false,
					// Preserve abbreviation resolution metadata from sampling
					abbreviations_resolved: samplingResult.metadata?.abbreviations_resolved,
					mapping_cached: samplingResult.metadata?.mapping_cached,
					abbreviations_unresolved: samplingResult.metadata?.abbreviations_unresolved,
				},
			};
		}

		// Sampling failed or returned empty, collect the error
		if (samplingResult.errors) {
			errors.push(...samplingResult.errors);
		}

		// Mark all errors as triggering fallback
		for (const error of errors) {
			error.fallback_used = true;
		}

		// Use static fallback
		console.info(
			"Dynamic discovery returned no agencies, using static fallback",
			{
				errors: errors.map(e => e.message),
			},
		);

		return this.getStaticFallback(errors);
	}

	/**
	 * Sample forecasts from JSON API to discover agencies
	 *
	 * Queries the most recent 100 forecasts and extracts unique agency codes.
	 * Resolves abbreviations to codes using the agency mapping.
	 * Caches the result for 24 hours if successful.
	 *
	 * @param apiKey Tango API key for authentication
	 * @returns Discovery result with sampled agencies
	 */
	private async sampleForecasts(
		apiKey: string,
	): Promise<AgencyForecastDiscoveryResult> {
		const errors: DiscoveryError[] = [];

		try {
			// Fetch abbreviation→code mapping first
			const { mapping: abbreviationMapping, cached: mappingCached } =
				await this.getAbbreviationMapping(apiKey);

			// Query forecast JSON (CSV format not supported)
			const response = await this.client.searchForecasts(
				{
					limit: SAMPLE_LIMIT,
					ordering: SAMPLE_ORDERING,
				},
				apiKey,
			);

			// Check for API errors
			if (!response.success || !response.data) {
				console.error("Forecast JSON query failed:", {
					error: response.error,
					status: response.status,
				});

				// Create API error directly
				const apiError: DiscoveryError = {
					code: 'API_ERROR',
					message: response.error || "API request failed",
					fallback_used: false,
					timestamp: new Date().toISOString(),
					context: {
						operation: 'api_request',
						status: response.status,
						original_error: response.error,
					},
				};
				errors.push(apiError);

				return {
					agencies: new Map(),
					cached: false,
					source: "dynamic",
					errors,
					metadata: {
						count: 0,
						fallback_used: false,
						mapping_cached: mappingCached,
					},
				};
			}

			// Parse JSON to extract agency codes and resolve abbreviations
			const jsonData = response.data as TangoForecastListResponse;
			const { agencies, resolved, unresolved } = this.extractAgenciesFromJSON(
				jsonData,
				abbreviationMapping,
			);

			// If parsing failed or no agencies found, record error
			if (agencies.size === 0) {
				const parseError = createDiscoveryError(
					new Error("No agencies found in JSON data"),
					"json_parsing",
					false
				);
				parseError.code = 'PARSE_ERROR';
				errors.push(parseError);
			}

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

					const cacheWriteError = createDiscoveryError(
						error,
						"cache_write",
						false
					);
					cacheWriteError.code = 'CACHE_WRITE_ERROR';
					errors.push(cacheWriteError);
				}
			}

			return {
				agencies,
				cached: false,
				source: "dynamic",
				sampled: jsonData.results?.length || 0,
				errors: errors.length > 0 ? errors : undefined,
				metadata: {
					count: agencies.size,
					fallback_used: false,
					abbreviations_resolved: resolved,
					mapping_cached: mappingCached,
					abbreviations_unresolved: unresolved > 0 ? unresolved : undefined,
				},
			};
		} catch (error) {
			// Catch any unexpected errors
			console.error("Unexpected error during agency forecast discovery:", {
				error: String(error),
			});

			const unexpectedError = createDiscoveryError(
				error,
				"unexpected",
				false
			);
			errors.push(unexpectedError);

			return {
				agencies: new Map(),
				cached: false,
				source: "dynamic",
				errors,
				metadata: {
					count: 0,
					fallback_used: false,
				},
			};
		}
	}

	/**
	 * Get static fallback list of agencies
	 *
	 * Used when CSV sampling fails or returns no results.
	 * Returns a conservative list of known forecast publishers.
	 *
	 * @param previousErrors Errors that led to fallback
	 * @returns Discovery result from static list
	 */
	private getStaticFallback(
		previousErrors: DiscoveryError[] = [],
	): AgencyForecastDiscoveryResult {
		const agencies = new Map<string, boolean>();
		const knownCodes = getKnownAgencyCodes();

		for (const code of knownCodes) {
			agencies.set(code, true);
		}

		// Find the most recent confirmation date
		const mostRecentConfirmation = KNOWN_AGENCIES_WITH_FORECASTS
			.map(a => a.confirmedAt)
			.sort()
			.reverse()[0];

		return {
			agencies,
			cached: false,
			source: "static_fallback",
			errors: previousErrors.length > 0 ? previousErrors : undefined,
			metadata: {
				count: agencies.size,
				fallback_used: true,
				static_updated: mostRecentConfirmation,
				warning: "Using static fallback data. Live discovery may show different results. This data was last confirmed from production testing.",
			},
		};
	}

	/**
	 * Fetch and cache agency abbreviation→code mapping
	 *
	 * Queries /api/agencies/ to build a complete mapping of abbreviations to codes.
	 * Caches the result for 24 hours (same TTL as forecast discovery).
	 *
	 * @param apiKey Tango API key for authentication
	 * @returns Map of abbreviation→code, plus cache hit indicator
	 */
	private async getAbbreviationMapping(
		apiKey: string,
	): Promise<{ mapping: Map<string, string>; cached: boolean }> {
		// Try cache first
		if (this.cache) {
			try {
				const cached = await this.cache.get<Record<string, string>>(MAPPING_CACHE_KEY);
				if (cached.hit && cached.data) {
					// Convert object back to Map
					const mapping = new Map<string, string>(Object.entries(cached.data));
					console.info("Agency abbreviation mapping loaded from cache", {
						entries: mapping.size,
					});
					return { mapping, cached: true };
				}
			} catch (error) {
				console.warn("Cache read failed for agency mapping:", {
					error: String(error),
				});
				// Continue to fetch from API
			}
		}

		// Fetch from API
		try {
			console.info("Fetching agency abbreviation mapping from /api/agencies/");

			// Fetch all agencies (use high limit to get complete mapping)
			const response = await this.client.searchAgencies(
				{ limit: 500 }, // Should cover all federal agencies
				apiKey,
			);

			if (!response.success || !response.data) {
				console.error("Failed to fetch agency mapping:", {
					error: response.error,
					status: response.status,
				});
				// Return empty mapping
				return { mapping: new Map(), cached: false };
			}

			// Build abbreviation→code mapping
			const mapping = new Map<string, string>();
			for (const agency of response.data.results || []) {
				if (agency.abbreviation && agency.code) {
					const abbr = agency.abbreviation.trim().toUpperCase();
					const code = agency.code.trim();
					mapping.set(abbr, code);
				}
			}

			console.info("Built agency abbreviation mapping", {
				entries: mapping.size,
				sample: Array.from(mapping.entries()).slice(0, 5),
			});

			// Cache the mapping (convert Map to object for JSON serialization)
			if (this.cache && mapping.size > 0) {
				try {
					const mappingObject = Object.fromEntries(mapping.entries());
					await this.cache.set(
						MAPPING_CACHE_KEY,
						mappingObject,
						MAPPING_CACHE_TTL_SECONDS,
					);
				} catch (error) {
					console.warn("Cache write failed for agency mapping:", {
						error: String(error),
					});
					// Continue without caching
				}
			}

			return { mapping, cached: false };
		} catch (error) {
			console.error("Unexpected error fetching agency mapping:", {
				error: String(error),
			});
			return { mapping: new Map(), cached: false };
		}
	}

	/**
	 * Extract unique agency codes from JSON data and resolve abbreviations to codes
	 *
	 * Iterates through forecast results, extracts abbreviations, and resolves them
	 * to official agency codes using the abbreviation→code mapping.
	 *
	 * @param jsonData Parsed JSON response from forecast API
	 * @param abbreviationMapping Map of abbreviation→code
	 * @returns Object with resolved agency codes and resolution statistics
	 */
	private extractAgenciesFromJSON(
		jsonData: TangoForecastListResponse,
		abbreviationMapping: Map<string, string>,
	): {
		agencies: Map<string, boolean>;
		resolved: number;
		unresolved: number;
	} {
		const agencies = new Map<string, boolean>();
		let resolved = 0;
		let unresolved = 0;

		try {
			// Extract unique agency abbreviations from results array
			if (jsonData.results && Array.isArray(jsonData.results)) {
				for (const forecast of jsonData.results) {
					const abbreviation = forecast.agency?.trim().toUpperCase();
					if (abbreviation && abbreviation.length > 0) {
						// Try to resolve abbreviation to code
						const code = abbreviationMapping.get(abbreviation);
						if (code) {
							agencies.set(code, true);
							resolved++;
						} else {
							// Store abbreviation as fallback (for backward compatibility)
							agencies.set(abbreviation, true);
							unresolved++;
							console.warn("Unable to resolve agency abbreviation to code", {
								abbreviation,
								forecast_id: forecast.id,
							});
						}
					}
				}
			}
		} catch (error) {
			console.error("JSON parsing failed during agency extraction:", {
				error: String(error),
			});
			// Return empty result - error will be handled upstream
		}

		console.info("Agency abbreviation resolution complete", {
			total: agencies.size,
			resolved,
			unresolved,
		});

		return { agencies, resolved, unresolved };
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
