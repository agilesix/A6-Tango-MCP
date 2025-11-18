/**
 * Unit tests for TangoApiClient
 *
 * Tests:
 * - Rate limiting behavior
 * - Error handling (auth, network, timeout, API errors)
 * - Input sanitization
 * - URL building
 * - Response parsing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TangoApiClient } from "@/api/tango-client";
import type { Env } from "@/types/env";
import {
  TangoAuthenticationError,
  TangoNetworkError,
  TangoTimeoutError,
  TangoApiError,
  TangoValidationError,
} from "@/types/errors";
import { resetRateLimiter } from "@/utils/rate-limiter";

// Mock environment
const mockEnv: Env = {
  TANGO_API_BASE_URL: "https://tango.makegov.com/api",
  TANGO_API_KEY: "test-api-key",
  TANGO_CACHE: {} as KVNamespace,
};

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("TangoApiClient", () => {
  let client: TangoApiClient;

  beforeEach(() => {
    client = new TangoApiClient(mockEnv);
    mockFetch.mockClear();
    resetRateLimiter();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("constructor", () => {
    it("should use default base URL if not provided", () => {
      const envWithoutUrl: Env = {
        TANGO_CACHE: {} as KVNamespace,
      };
      const testClient = new TangoApiClient(envWithoutUrl);
      expect(testClient).toBeDefined();
    });

    it("should use custom base URL if provided", () => {
      const envWithCustomUrl: Env = {
        TANGO_API_BASE_URL: "https://custom.api.url",
        TANGO_CACHE: {} as KVNamespace,
      };
      const testClient = new TangoApiClient(envWithCustomUrl);
      expect(testClient).toBeDefined();
    });
  });

  describe("searchContracts", () => {
    it("should make successful contract search request", async () => {
      const mockResponse = {
        results: [
          {
            key: "contract-123",
            title: "Test Contract",
            obligated: 100000,
          },
        ],
        total: 1,
        count: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.searchContracts({ limit: 10 }, "test-api-key");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(result.status).toBe(200);
    });

    it("should throw authentication error when API key is missing", async () => {
      await expect(client.searchContracts({ limit: 10 }, "")).rejects.toThrow(
        TangoAuthenticationError,
      );
    });

    it("should sanitize input parameters", async () => {
      const mockResponse = { results: [], total: 0, count: 0 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.searchContracts(
        {
          query: "test\x00\x01query", // Control characters
          vendor_name: "  Vendor Name  ", // Leading/trailing spaces
        },
        "test-api-key",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("query=testquery"),
        expect.any(Object),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("vendor_name=Vendor+Name"),
        expect.any(Object),
      );
    });
  });

  describe("searchGrants", () => {
    it("should make successful grant search request", async () => {
      const mockResponse = {
        results: [
          {
            fain: "grant-456",
            title: "Test Grant",
            award_amount: 50000,
          },
        ],
        total: 1,
        count: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.searchGrants({ limit: 10 }, "test-api-key");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });
  });

  describe("getVendorProfile", () => {
    it("should make successful vendor profile request", async () => {
      const mockResponse = {
        uei: "J3RW5C5KVLZ1",
        legal_business_name: "Test Vendor LLC",
        total_contracts: 10,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getVendorProfile("J3RW5C5KVLZ1", "test-api-key");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });

    it("should validate UEI format", async () => {
      await expect(client.getVendorProfile("invalid", "test-api-key")).rejects.toThrow(
        TangoValidationError,
      );

      await expect(client.getVendorProfile("", "test-api-key")).rejects.toThrow(
        TangoValidationError,
      );

      await expect(
        client.getVendorProfile("J3RW5C5KVLZ", "test-api-key"),
      ).rejects.toThrow(TangoValidationError);
    });

    it("should accept valid UEI formats", async () => {
      const mockResponse = { uei: "J3RW5C5KVLZ1" };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Uppercase
      await expect(
        client.getVendorProfile("J3RW5C5KVLZ1", "test-api-key"),
      ).resolves.toBeDefined();

      // Lowercase (should be accepted)
      await expect(
        client.getVendorProfile("j3rw5c5kvlz1", "test-api-key"),
      ).resolves.toBeDefined();

      // Mixed case
      await expect(
        client.getVendorProfile("J3rW5c5KvLz1", "test-api-key"),
      ).resolves.toBeDefined();
    });
  });

  describe("searchOpportunities", () => {
    it("should make successful opportunity search request", async () => {
      const mockResponse = {
        results: [
          {
            opportunity_id: "opp-789",
            title: "Test Opportunity",
            active: true,
          },
        ],
        total: 1,
        count: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.searchOpportunities({ limit: 10 }, "test-api-key");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });
  });

  describe("error handling", () => {
    it("should handle 404 Not Found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: "Resource not found" }),
        headers: new Headers(),
      });

      await expect(client.searchContracts({ limit: 10 }, "test-api-key")).rejects.toThrow(
        TangoApiError,
      );
    });

    it("should handle 429 Rate Limit with Retry-After header", async () => {
      const headers = new Headers();
      headers.set("Retry-After", "5");

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: "Rate limit exceeded" }),
        headers,
      });

      try {
        await client.searchContracts({ limit: 10 }, "test-api-key");
        expect.fail("Should have thrown TangoApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(TangoApiError);
        if (error instanceof TangoApiError) {
          expect(error.statusCode).toBe(429);
          expect(error.retryAfterMs).toBe(5000);
        }
      }
    });

    it("should handle 500 Server Error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal server error" }),
        headers: new Headers(),
      });

      await expect(client.searchContracts({ limit: 10 }, "test-api-key")).rejects.toThrow(
        TangoApiError,
      );
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network connection failed"));

      await expect(client.searchContracts({ limit: 10 }, "test-api-key")).rejects.toThrow(
        TangoNetworkError,
      );
    });

    it("should handle timeout errors", async () => {
      // Mock AbortError to simulate timeout
      mockFetch.mockRejectedValueOnce({
        name: "AbortError",
        message: "The operation was aborted",
      });

      await expect(client.searchContracts({ limit: 10 }, "test-api-key")).rejects.toThrow(
        TangoTimeoutError,
      );
    });
  });

  describe("input sanitization", () => {
    it("should strip control characters from strings", async () => {
      const mockResponse = { results: [], total: 0, count: 0 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.searchContracts(
        {
          query: "test\x00\x01\x02query\x7F",
        },
        "test-api-key",
      );

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("query=testquery");
      expect(callUrl).not.toMatch(/[\x00-\x1F\x7F]/);
    });

    it("should trim whitespace from strings", async () => {
      const mockResponse = { results: [], total: 0, count: 0 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.searchContracts(
        {
          vendor_name: "   Test Vendor   ",
        },
        "test-api-key",
      );

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("vendor_name=Test+Vendor");
    });

    it("should handle null and undefined values", async () => {
      const mockResponse = { results: [], total: 0, count: 0 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.searchContracts(
        {
          query: "test",
          vendor_name: null,
          agency: undefined,
        },
        "test-api-key",
      );

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("query=test");
      expect(callUrl).not.toContain("vendor_name");
      expect(callUrl).not.toContain("agency");
    });

    it("should preserve numbers and booleans", async () => {
      const mockResponse = { results: [], total: 0, count: 0 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.searchContracts(
        {
          limit: 50,
          active: true,
        },
        "test-api-key",
      );

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("limit=50");
      expect(callUrl).toContain("active=true");
    });
  });

  describe("rate limiting", () => {
    it("should enforce minimum delay between requests", async () => {
      const mockResponse = { results: [], total: 0, count: 0 };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const start = Date.now();

      // Make 3 consecutive requests
      await client.searchContracts({ limit: 10 }, "test-api-key");
      await client.searchContracts({ limit: 10 }, "test-api-key");
      await client.searchContracts({ limit: 10 }, "test-api-key");

      const elapsed = Date.now() - start;

      // Should take at least 200ms (2 delays of 100ms each)
      expect(elapsed).toBeGreaterThanOrEqual(200);
    });
  });

  describe("URL building", () => {
    it("should build correct URLs with query parameters", async () => {
      const mockResponse = { results: [], total: 0, count: 0 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.searchContracts(
        {
          query: "test",
          limit: 50,
          vendor_uei: "J3RW5C5KVLZ1",
        },
        "test-api-key",
      );

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("/contracts/");
      expect(callUrl).toContain("query=test");
      expect(callUrl).toContain("limit=50");
      expect(callUrl).toContain("vendor_uei=J3RW5C5KVLZ1");
    });

    it("should properly encode special characters in parameters", async () => {
      const mockResponse = { results: [], total: 0, count: 0 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.searchContracts(
        {
          query: "test & development",
        },
        "test-api-key",
      );

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("query=test+%26+development");
    });
  });

  describe("request headers", () => {
    it("should include correct headers", async () => {
      const mockResponse = { results: [], total: 0, count: 0 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.searchContracts({ limit: 10 }, "test-api-key-123");

      const callOptions = mockFetch.mock.calls[0][1] as RequestInit;
      expect(callOptions.headers).toMatchObject({
        Accept: "application/json",
        "X-API-Key": "test-api-key-123",
        "User-Agent": "Tango-MCP/1.0.0",
      });
    });
  });

  describe("getAgencyContracts", () => {
    it("should make successful agency contracts request for awarding role", async () => {
      const mockResponse = {
        results: [
          {
            key: "contract-123",
            title: "DOD Contract",
            obligated: 1000000,
          },
        ],
        total: 1,
        count: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getAgencyContracts(
        "DOD",
        "awarding",
        { fiscal_year: 2024 },
        "test-api-key"
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(result.status).toBe(200);

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("/agencies/DOD/contracts/awarding/");
      expect(callUrl).toContain("fiscal_year=2024");
    });

    it("should make successful agency contracts request for funding role", async () => {
      const mockResponse = {
        results: [],
        total: 0,
        count: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getAgencyContracts(
        "GSA",
        "funding",
        { limit: 50 },
        "test-api-key"
      );

      expect(result.success).toBe(true);

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("/agencies/GSA/contracts/funding/");
    });

    it("should throw validation error when agency code is missing", async () => {
      await expect(
        client.getAgencyContracts("", "awarding", {}, "test-api-key")
      ).rejects.toThrow(TangoValidationError);
    });

    it("should handle agency codes with different formats", async () => {
      const mockResponse = { results: [], total: 0, count: 0 };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Test various agency code formats
      await client.getAgencyContracts("DOD", "awarding", {}, "test-api-key");
      await client.getAgencyContracts("7000", "awarding", {}, "test-api-key");
      await client.getAgencyContracts("ED", "awarding", {}, "test-api-key");

      expect(mockFetch).toHaveBeenCalledTimes(3);

      const urls = mockFetch.mock.calls.map((call) => call[0] as string);
      expect(urls[0]).toContain("/agencies/DOD/contracts/awarding/");
      expect(urls[1]).toContain("/agencies/7000/contracts/awarding/");
      expect(urls[2]).toContain("/agencies/ED/contracts/awarding/");
    });
  });
});
