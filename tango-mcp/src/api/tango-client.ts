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
  TangoGrantListResponse,
  TangoVendorResponse,
  TangoOpportunityListResponse,
} from "@/types/tango-api";
import {
  TangoAuthenticationError,
  TangoNetworkError,
  TangoTimeoutError,
  TangoApiError,
  TangoValidationError,
} from "@/types/errors";
import { enforceRateLimit } from "@/utils/rate-limiter";

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
}

/**
 * Tango API Client
 * Main interface for all Tango API operations
 */
export class TangoApiClient {
  private readonly baseUrl: string;
  private readonly defaultTimeout = 30000; // 30 seconds

  constructor(env: Env) {
    this.baseUrl = env.TANGO_API_BASE_URL || "https://tango.makegov.com/api";
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
   * Search federal grants from USASpending
   *
   * @param params Query parameters for grant search
   * @param apiKey Tango API key
   * @returns Grant search results
   */
  async searchGrants(
    params: Record<string, unknown>,
    apiKey: string,
  ): Promise<ApiResponse<TangoGrantListResponse>> {
    return this.get<TangoGrantListResponse>("/grants/", params, apiKey);
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
   * Generic GET request to Tango API
   *
   * @param endpoint API endpoint path (e.g., "/contracts/")
   * @param params Query parameters
   * @param apiKey Tango API key
   * @returns API response
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

    // Build URL with query parameters
    const url = this.buildUrl(endpoint, sanitizedParams);

    // Enforce rate limiting
    await enforceRateLimit();

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

      try {
        // Make fetch request
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
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

        // Parse JSON response
        const data = (await response.json()) as T;

        return {
          success: true,
          data,
          status: response.status,
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
    const url = new URL(endpoint, this.baseUrl);

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
        sanitized[key] = value.replace(/[\x00-\x1F\x7F]/g, "").trim();
      } else if (typeof value === "number" || typeof value === "boolean") {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
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
 * @returns TangoApiClient instance
 */
export function createTangoClient(env: Env): TangoApiClient {
  return new TangoApiClient(env);
}
