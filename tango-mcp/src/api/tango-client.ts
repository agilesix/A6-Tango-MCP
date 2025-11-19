/**
 * Tango API Client
 *
 * Type-safe client for the Tango federal contracting API.
 * Features:
 * - fetch-based (Cloudflare Workers compatible)
 * - 30-second timeout using AbortController
 * - Rate limiting (100ms between requests)
 * - Input sanitization
 * - Structured error handling
 * - Response normalization
 *
 * Design principle: Defense in depth with comprehensive error handling
 */

import type { Env } from "@/types/env";
import type {
  TangoContractListResponse,
  TangoContractDetailResponse,
  TangoGrantListResponse,
  TangoGrantOpportunityListResponse,
  TangoGrantOpportunityDetailResponse,
  TangoVendorResponse,
  TangoOpportunityListResponse,
  TangoOpportunityDetailResponse,
  TangoForecastListResponse,
  TangoForecastDetailResponse,
} from "@/types/tango-api";
import {
  TangoAuthenticationError,
  TangoNetworkError,
  TangoTimeoutError,
  TangoApiError,
  TangoValidationError,
} from "@/types/errors";
import { enforceRateLimit } from "@/utils/rate-limiter";
import type { CacheManager } from "@/cache/kv-cache";
import { generateCacheKey } from "@/utils/cache-key";

/**
 * API client response wrapper
 */
export interface ApiResponse<T> {
  /** Response data (if successful) */
  data?: T;
  /** Success flag */
  success: boolean;
  /** Error message (if failed) */
  error?: string;
  /** HTTP status code */
  status?: number;
  /** Cache metadata */
  cache?: {
    /** Whether this response came from cache */
    hit: boolean;
    /** Cache key used (if applicable) */
    key?: string;
  };
  /** Format of the response data ('json' or 'csv') */
  format?: 'json' | 'csv';
}

/**
 * Tango API Client
 * Main interface for all Tango API operations
 */
export class TangoApiClient {
  private readonly baseUrl: string;
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly cache?: CacheManager;

  constructor(env: Env, cache?: CacheManager) {
    this.baseUrl = env.TANGO_API_BASE_URL || "https://tango.makegov.com/api";
    this.cache = cache;
  }

  /**
   * Search federal contracts from FPDS
   *
   * @param params Query parameters for contract search
   * @param apiKey Tango API key
   * @returns Contract search results
   */
  async searchContracts(
    params: Record<string, unknown>,
    apiKey: string,
  ): Promise<ApiResponse<TangoContractListResponse>> {
    return this.get<TangoContractListResponse>("/contracts/", params, apiKey);
  }

  /**
   * Search grant opportunities from Grants.gov
   *
   * Returns pre-award grant opportunities, NOT post-award USASpending data.
   * These are opportunities available for application.
   *
   * Supported parameters:
   * - search: Free-text search across titles and descriptions
   * - agency: Agency abbreviation (e.g., "ED", "NSF")
   * - cfda_number: CFDA number filter
   * - posted_date_after/before: Posted date range
   * - response_date_after/before: Response deadline range
   * - applicant_types: Comma-separated applicant type codes
   * - funding_categories: Comma-separated funding category codes
   * - funding_instruments: Comma-separated instrument codes (G, CA, PC, etc.)
   * - status: P (Posted) or F (Forecasted)
   * - ordering: Sort field (e.g., "posted_date", "-response_date")
   * - limit: Maximum results (default: 25, max: 100)
   *
   * @param params Query parameters for opportunity search
   * @param apiKey Tango API key
   * @returns Grant opportunity search results
   */
  async searchGrants(
    params: Record<string, unknown>,
    apiKey: string,
  ): Promise<ApiResponse<TangoGrantOpportunityListResponse>> {
    return this.get<TangoGrantOpportunityListResponse>("/grants/", params, apiKey);
  }

  /**
   * Get vendor/entity profile from SAM.gov
   *
   * @param uei Unique Entity Identifier
   * @param apiKey Tango API key
   * @returns Vendor profile
   */
  async getVendorProfile(
    uei: string,
    apiKey: string,
  ): Promise<ApiResponse<TangoVendorResponse>> {
    // Validate UEI format (12 alphanumeric characters)
    if (!uei || uei.length !== 12 || !/^[A-Z0-9]{12}$/i.test(uei)) {
      throw new TangoValidationError(
        "Invalid UEI format",
        "uei",
        uei,
        "12-character alphanumeric",
        "J3RW5C5KVLZ1",
      );
    }

    return this.get<TangoVendorResponse>(`/entities/${uei}/`, {}, apiKey);
  }

  /**
   * Get vendor contract history
   *
   * @param uei Unique Entity Identifier
   * @param params Query parameters (limit, ordering)
   * @param apiKey Tango API key
   * @returns Vendor contract history
   */
  async getVendorContracts(
    uei: string,
    params: Record<string, unknown>,
    apiKey: string,
  ): Promise<ApiResponse<TangoContractListResponse>> {
    if (!uei || uei.length !== 12) {
      throw new TangoValidationError("Invalid UEI format", "uei", uei);
    }

    return this.get<TangoContractListResponse>(`/entities/${uei}/contracts/`, params, apiKey);
  }

  /**
   * Get vendor grant/subaward history
   *
   * @param uei Unique Entity Identifier
   * @param params Query parameters (limit, ordering)
   * @param apiKey Tango API key
   * @returns Vendor grant history
   */
  async getVendorGrants(
    uei: string,
    params: Record<string, unknown>,
    apiKey: string,
  ): Promise<ApiResponse<TangoGrantListResponse>> {
    if (!uei || uei.length !== 12) {
      throw new TangoValidationError("Invalid UEI format", "uei", uei);
    }

    return this.get<TangoGrantListResponse>(`/entities/${uei}/subawards/`, params, apiKey);
  }

  /**
   * Search contract opportunities from SAM.gov
   *
   * @param params Query parameters for opportunity search
   * @param apiKey Tango API key
   * @returns Opportunity search results
   */
  async searchOpportunities(
    params: Record<string, unknown>,
    apiKey: string,
  ): Promise<ApiResponse<TangoOpportunityListResponse>> {
    return this.get<TangoOpportunityListResponse>("/opportunities/", params, apiKey);
  }

  /**
   * Get contract detail by key/award ID
   *
   * @param contractKey Contract key/award ID (e.g., "CONT_AWD_xxxxx")
   * @param apiKey Tango API key
   * @returns Contract detail information
   */
  async getContractDetail(
    contractKey: string,
    apiKey: string,
  ): Promise<ApiResponse<TangoContractDetailResponse>> {
    return this.get<TangoContractDetailResponse>(`/contracts/${contractKey}/`, {}, apiKey);
  }

  /**
   * Get grant opportunity detail by grant ID
   *
   * @param grantId Grant opportunity ID (numeric)
   * @param apiKey Tango API key
   * @returns Grant opportunity detail information
   */
  async getGrantDetail(
    grantId: number,
    apiKey: string,
  ): Promise<ApiResponse<TangoGrantOpportunityDetailResponse>> {
    return this.get<TangoGrantOpportunityDetailResponse>(`/grants/${grantId}/`, {}, apiKey);
  }

  /**
   * Get opportunity detail by opportunity ID
   *
   * @param opportunityId Opportunity ID (UUID string)
   * @param apiKey Tango API key
   * @returns Opportunity detail information
   */
  async getOpportunityDetail(
    opportunityId: string,
    apiKey: string,
  ): Promise<ApiResponse<TangoOpportunityDetailResponse>> {
    return this.get<TangoOpportunityDetailResponse>(`/opportunities/${opportunityId}/`, {}, apiKey);
  }

  /**
   * Search forecast opportunities from multiple government agencies
   *
   * Supported parameters:
   * - search: Free-text search across titles and descriptions
   * - agency: Agency acronym filter (supports HHS|DHS OR logic and HHS,DHS AND logic)
   * - source_system: Source system filter (HHS|DHS|GSA with OR/AND patterns)
   * - naics_code: Exact NAICS code filter (supports 541511|541512 OR logic)
   * - naics_starts_with: NAICS prefix filter (e.g., "54" for Professional Services)
   * - fiscal_year: Exact fiscal year filter
   * - fiscal_year_gte: Fiscal year greater than or equal to
   * - fiscal_year_lte: Fiscal year less than or equal to
   * - status: Status filter (PUBLISHED|DRAFT with OR logic)
   * - award_date_after: Award date on or after (YYYY-MM-DD)
   * - award_date_before: Award date on or before (YYYY-MM-DD)
   * - modified_after: Modified in Tango on or after (YYYY-MM-DD)
   * - modified_before: Modified in Tango on or before (YYYY-MM-DD)
   * - ordering: Sort field (e.g., "anticipated_award_date", "-fiscal_year")
   * - page: Page number for pagination
   * - limit: Maximum results (default: 25, max: 100)
   * - format: Response format (json or csv)
   *
   * @param params Query parameters for forecast search
   * @param apiKey Tango API key
   * @returns Forecast search results
   */
  async searchForecasts(
    params: Record<string, unknown>,
    apiKey: string,
  ): Promise<ApiResponse<TangoForecastListResponse>> {
    return this.get<TangoForecastListResponse>("/forecasts/", params, apiKey);
  }

  /**
   * Get detailed forecast information by ID
   *
   * Returns comprehensive forecast details including raw source system data
   * and formatted display representation.
   *
   * @param forecastId Forecast ID (integer)
   * @param apiKey Tango API key
   * @returns Forecast detail data
   */
  async getForecastDetail(
    forecastId: string | number,
    apiKey: string,
  ): Promise<ApiResponse<TangoForecastDetailResponse>> {
    return this.get<TangoForecastDetailResponse>(`/forecasts/${forecastId}/`, {}, apiKey);
  }

  /**
   * Get agency contracts (awarding or funding)
   *
   * Retrieves contracts for a specific agency using Tango's agency-specific endpoints.
   * Supports both awarding agency and funding agency perspectives.
   *
   * @param agencyCode Agency code (e.g., "DOD", "GSA", "ED", "7000")
   * @param role "awarding" or "funding" - whether agency is awarding or funding contracts
   * @param params Query parameters (fiscal_year, limit, ordering, etc.)
   * @param apiKey Tango API key
   * @returns Agency contract list
   */
  async getAgencyContracts(
    agencyCode: string,
    role: "awarding" | "funding",
    params: Record<string, unknown>,
    apiKey: string,
  ): Promise<ApiResponse<TangoContractListResponse>> {
    if (!agencyCode) {
      throw new TangoValidationError("Agency code is required", "agencyCode", agencyCode);
    }

    const endpoint = `/agencies/${agencyCode}/contracts/${role}/`;
    return this.get<TangoContractListResponse>(endpoint, params, apiKey);
  }

  /**
   * Generic GET request to Tango API with optional caching
   *
   * @param endpoint API endpoint path (e.g., "/contracts/")
   * @param params Query parameters
   * @param apiKey Tango API key
   * @returns API response with cache metadata
   */
  async get<T>(
    endpoint: string,
    params: Record<string, unknown>,
    apiKey: string,
  ): Promise<ApiResponse<T>> {
    // Validate API key
    if (!apiKey) {
      throw new TangoAuthenticationError();
    }

    // Sanitize input parameters
    const sanitizedParams = this.sanitizeInput(params);

    // Generate cache key if caching is enabled
    let cacheKey: string | undefined;
    if (this.cache) {
      // Use endpoint as tool name for cache key
      const toolName = endpoint.replace(/^\//, "").replace(/\/$/, "").replace(/\//g, "_");
      cacheKey = await generateCacheKey(toolName, sanitizedParams);

      // Try to get from cache
      const cached = await this.cache.get<T>(cacheKey);
      if (cached.hit && cached.data) {
        return {
          success: true,
          data: cached.data,
          status: 200,
          cache: {
            hit: true,
            key: cacheKey,
          },
        };
      }
    }

    // Build URL with query parameters
    const url = this.buildUrl(endpoint, sanitizedParams);

    // Enforce rate limiting (only for actual API calls)
    await enforceRateLimit();

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

      try {
        // Make fetch request
        const acceptHeader = sanitizedParams.format === 'csv' ? 'text/csv' : 'application/json';
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: acceptHeader,
            "X-API-Key": apiKey,
            "User-Agent": "Tango-MCP/1.0.0",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle non-OK responses
        if (!response.ok) {
          return this.handleErrorResponse(response);
        }

        // Determine response format from Content-Type header
        const contentType = response.headers?.get("Content-Type") || "";
        const isCSV = contentType.includes("text/csv");

        // Parse response based on content type
        let data: T;
        let format: 'json' | 'csv' = 'json';

        if (isCSV) {
          // For CSV responses, return the raw text as data
          data = (await response.text()) as unknown as T;
          format = 'csv';
        } else {
          // Parse JSON response
          data = (await response.json()) as T;
          format = 'json';
        }

        // Cache successful responses (only cache JSON for now, not CSV)
        if (this.cache && cacheKey && !isCSV) {
          await this.cache.set(cacheKey, data);
        }

        return {
          success: true,
          data,
          status: response.status,
          format,
          cache: this.cache
            ? {
                hit: false,
                key: cacheKey,
              }
            : undefined,
        };
      } catch (error) {
        clearTimeout(timeoutId);

        // Handle abort (timeout)
        // Check both Error instances and plain objects with name property
        if (
          (error instanceof Error && error.name === "AbortError") ||
          (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError")
        ) {
          throw new TangoTimeoutError();
        }

        throw error;
      }
    } catch (error) {
      // Re-throw Tango errors as-is
      if (
        error instanceof TangoAuthenticationError ||
        error instanceof TangoValidationError ||
        error instanceof TangoApiError ||
        error instanceof TangoTimeoutError
      ) {
        throw error;
      }

      // Wrap other errors as network errors
      throw new TangoNetworkError(`Network request failed: ${String(error)}`, error);
    }
  }

  /**
   * Build URL with query parameters
   *
   * @param endpoint API endpoint path
   * @param params Query parameters
   * @returns Full URL with query string
   */
  private buildUrl(endpoint: string, params: Record<string, unknown>): string {
    // Ensure baseUrl ends with / and endpoint doesn't start with / to avoid path replacement
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const path = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const url = new URL(path, base);

    // Add query parameters
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    }

    return url.toString();
  }

  /**
   * Handle error responses from Tango API
   *
   * @param response Fetch response object
   * @returns Error response
   */
  private async handleErrorResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const status = response.status;

    // Try to parse error body
    let errorMessage = `Tango API returned ${status}`;
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody === "object" && "error" in errorBody) {
        errorMessage = String(errorBody.error);
      } else if (errorBody && typeof errorBody === "object" && "detail" in errorBody) {
        errorMessage = String(errorBody.detail);
      }
    } catch {
      // Ignore JSON parse errors
    }

    // Extract retry-after header for rate limiting
    let retryAfterMs: number | undefined;
    if (status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      if (retryAfter) {
        const seconds = Number.parseInt(retryAfter, 10);
        if (!Number.isNaN(seconds)) {
          retryAfterMs = seconds * 1000;
        }
      }
    }

    throw new TangoApiError(errorMessage, status, retryAfterMs);
  }

  /**
   * Sanitize input parameters
   *
   * Strips control characters and normalizes values to prevent
   * injection attacks and handle edge cases.
   *
   * @param params Input parameters
   * @returns Sanitized parameters
   */
  private sanitizeInput(params: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === "string") {
        // Strip control characters and trim
        // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally checking for control characters
        sanitized[key] = value.replace(/[\x00-\x1F\x7F]/g, "").trim();
      } else if (typeof value === "number" || typeof value === "boolean") {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
          // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally checking for control characters
          typeof item === "string" ? item.replace(/[\x00-\x1F\x7F]/g, "").trim() : item,
        );
      } else if (typeof value === "object") {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeInput(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

/**
 * Create Tango API client instance
 *
 * @param env Cloudflare Workers environment bindings
 * @param cache Optional cache manager for response caching
 * @returns TangoApiClient instance
 */
export function createTangoClient(env: Env, cache?: CacheManager): TangoApiClient {
  return new TangoApiClient(env, cache);
}
