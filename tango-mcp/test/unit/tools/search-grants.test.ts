/**
 * Unit tests for search_tango_grants tool
 *
 * Tests:
 * - Client-side filtering (recipient name, UEI, amount ranges)
 * - Input sanitization
 * - API integration
 * - Response formatting
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerSearchGrantsTool } from "@/tools/search-grants";
import type { Env } from "@/types/env";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const mockEnv: Env = {
  TANGO_API_BASE_URL: "https://tango.makegov.com/api",
  TANGO_API_KEY: "test-api-key",
  TANGO_CACHE: {} as KVNamespace,
};

const mockServer = {
  tool: vi.fn(),
} as unknown as McpServer;

vi.mock("@/api/tango-client", () => ({
  TangoApiClient: vi.fn().mockImplementation(() => ({
    searchGrants: vi.fn(),
  })),
}));

describe("search_tango_grants tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registration", () => {
    it("should register with correct name", () => {
      registerSearchGrantsTool(mockServer, mockEnv);

      expect(mockServer.tool).toHaveBeenCalledWith(
        "search_tango_grants",
        expect.stringContaining("federal grants"),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it("should define client-side filter parameters", () => {
      registerSearchGrantsTool(mockServer, mockEnv);

      const callArgs = (mockServer.tool as any).mock.calls[0];
      const schema = callArgs[2];

      expect(schema).toHaveProperty("recipient_name");
      expect(schema).toHaveProperty("recipient_uei");
      expect(schema).toHaveProperty("award_amount_min");
      expect(schema).toHaveProperty("award_amount_max");
    });
  });

  describe("client-side filtering", () => {
    it("should filter by recipient name (case-insensitive)", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGrants = [
        { recipient: { name: "Stanford University", uei: "ABC123" }, award_amount: 500000 },
        { recipient: { name: "MIT", uei: "DEF456" }, award_amount: 750000 },
        { recipient: { name: "Harvard University", uei: "GHI789" }, award_amount: 1000000 },
      ];

      const mockSearchGrants = vi.fn().mockResolvedValue({
        success: true,
        data: { results: mockGrants, total: 3 },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        searchGrants: mockSearchGrants,
      }));

      registerSearchGrantsTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        recipient_name: "University",
        limit: 10,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.returned).toBe(2); // Only Stanford and Harvard
      expect(data.client_side_filters.applied).toBe(true);
      expect(data.client_side_filters.recipient_name).toBe(true);
    });

    it("should filter by recipient UEI", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGrants = [
        { recipient: { name: "Org 1", uei: "ABC123" }, award_amount: 500000 },
        { recipient: { name: "Org 2", uei: "DEF456" }, award_amount: 750000 },
      ];

      const mockSearchGrants = vi.fn().mockResolvedValue({
        success: true,
        data: { results: mockGrants, total: 2 },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        searchGrants: mockSearchGrants,
      }));

      registerSearchGrantsTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        recipient_uei: "ABC123",
        limit: 10,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.returned).toBe(1);
      expect(data.data[0].recipient.uei).toBe("ABC123");
    });

    it("should filter by award amount range", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGrants = [
        { recipient: { name: "Org 1", uei: "ABC" }, award_amount: 50000 },
        { recipient: { name: "Org 2", uei: "DEF" }, award_amount: 150000 },
        { recipient: { name: "Org 3", uei: "GHI" }, award_amount: 250000 },
        { recipient: { name: "Org 4", uei: "JKL" }, award_amount: 1500000 },
      ];

      const mockSearchGrants = vi.fn().mockResolvedValue({
        success: true,
        data: { results: mockGrants, total: 4 },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        searchGrants: mockSearchGrants,
      }));

      registerSearchGrantsTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        award_amount_min: 100000,
        award_amount_max: 1000000,
        limit: 10,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.returned).toBe(2); // 150k and 250k
      expect(data.client_side_filters.award_amount_range).toBe(true);
    });

    it("should combine multiple client-side filters", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGrants = [
        { recipient: { name: "Stanford University", uei: "ABC" }, award_amount: 500000 },
        { recipient: { name: "MIT University", uei: "DEF" }, award_amount: 1500000 },
        { recipient: { name: "Harvard University", uei: "GHI" }, award_amount: 250000 },
      ];

      const mockSearchGrants = vi.fn().mockResolvedValue({
        success: true,
        data: { results: mockGrants, total: 3 },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        searchGrants: mockSearchGrants,
      }));

      registerSearchGrantsTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        recipient_name: "University",
        award_amount_min: 200000,
        award_amount_max: 1000000,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.returned).toBe(2); // Stanford (500k) and Harvard (250k)
    });
  });

  describe("API integration", () => {
    it("should not send client-side filter params to API", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockSearchGrants = vi.fn().mockResolvedValue({
        success: true,
        data: { results: [], total: 0 },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        searchGrants: mockSearchGrants,
      }));

      registerSearchGrantsTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      await handler({
        query: "education",
        recipient_name: "University", // Client-side only
        award_amount_min: 100000, // Client-side only
        limit: 10,
      });

      const callParams = mockSearchGrants.mock.calls[0][0];
      expect(callParams.search).toBe("education");
      expect(callParams.recipient_name).toBeUndefined();
      expect(callParams.award_amount_min).toBeUndefined();
    });
  });

  describe("response formatting", () => {
    it("should include client_side_filters metadata", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockSearchGrants = vi.fn().mockResolvedValue({
        success: true,
        data: { results: [], total: 0 },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        searchGrants: mockSearchGrants,
      }));

      registerSearchGrantsTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        recipient_name: "University",
        award_amount_min: 100000,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.client_side_filters).toBeDefined();
      expect(data.client_side_filters.applied).toBe(true);
      expect(data.client_side_filters.recipient_name).toBe(true);
      expect(data.client_side_filters.award_amount_range).toBe(true);
    });

    it("should mark no client-side filters when none applied", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockSearchGrants = vi.fn().mockResolvedValue({
        success: true,
        data: { results: [], total: 0 },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        searchGrants: mockSearchGrants,
      }));

      registerSearchGrantsTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({ query: "education" });

      const data = JSON.parse(result.content[0].text);
      expect(data.client_side_filters.applied).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle missing API key", async () => {
      const envWithoutKey: Env = {
        TANGO_CACHE: {} as KVNamespace,
      };

      registerSearchGrantsTool(mockServer, envWithoutKey);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({ limit: 10 });

      const data = JSON.parse(result.content[0].text);
      expect(data.error_code).toBe("MISSING_API_KEY");
    });

    it("should handle API errors", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockSearchGrants = vi.fn().mockResolvedValue({
        success: false,
        error: "Service unavailable",
        status: 503,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        searchGrants: mockSearchGrants,
      }));

      registerSearchGrantsTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({ limit: 10 });

      const data = JSON.parse(result.content[0].text);
      expect(data.error_code).toBe("API_ERROR");
      expect(data.status).toBe(503);
    });
  });
});
