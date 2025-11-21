/**
 * Unit tests for get_tango_grant_detail tool
 *
 * Tests:
 * - Parameter validation
 * - API client integration
 * - Response formatting
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerGetGrantDetailTool } from "@/tools/get-grant-detail";
import type { Env } from "@/types/env";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Mock environment
const mockEnv: Env = {
  TANGO_API_BASE_URL: "https://tango.makegov.com/api",
  TANGO_API_KEY: "test-api-key",
  TANGO_CACHE: {} as KVNamespace,
};

// Mock server
const mockServer = {
  tool: vi.fn(),
} as unknown as McpServer;

// Mock TangoApiClient
vi.mock("@/api/tango-client", () => ({
  TangoApiClient: vi.fn().mockImplementation(() => ({
    getGrantDetail: vi.fn(),
  })),
}));

describe("get_tango_grant_detail tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registration", () => {
    it("should register with correct name and description", () => {
      registerGetGrantDetailTool(mockServer, mockEnv);

      expect(mockServer.tool).toHaveBeenCalledWith(
        "get_grant_detail",
        expect.stringContaining("detailed information for a specific grant opportunity"),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it("should define grant_id parameter", () => {
      registerGetGrantDetailTool(mockServer, mockEnv);

      const callArgs = (mockServer.tool as any).mock.calls[0];
      const schema = callArgs[2];

      expect(schema).toHaveProperty("grant_id");
    });
  });

  describe("parameter validation", () => {
    it("should require grant_id parameter", async () => {
      registerGetGrantDetailTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({});

      expect(result.content[0].text).toContain("grant_id parameter is required");
    });

    it("should accept valid grant ID", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGetGrantDetail = vi.fn().mockResolvedValue({
        success: true,
        data: { grant_id: 12345, title: "Test Grant" },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        getGrantDetail: mockGetGrantDetail,
      }));

      registerGetGrantDetailTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      await handler({
        grant_id: 12345,
      });

      expect(mockGetGrantDetail).toHaveBeenCalledWith(12345, "test-api-key");
    });
  });

  describe("API integration", () => {
    it("should handle successful API response", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockData = {
        grant_id: 12345,
        title: "Test Grant Opportunity",
        opportunity_number: "TEST-2024-001",
        description: "Test grant description",
      };

      const mockGetGrantDetail = vi.fn().mockResolvedValue({
        success: true,
        data: mockData,
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        getGrantDetail: mockGetGrantDetail,
      }));

      registerGetGrantDetailTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        grant_id: 12345,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.data).toEqual(mockData);
      expect(response.grant_id).toBe(12345);
      expect(response.execution).toHaveProperty("duration_ms");
    });

    it("should handle API error", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGetGrantDetail = vi.fn().mockResolvedValue({
        success: false,
        error: "Grant not found",
        status: 404,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        getGrantDetail: mockGetGrantDetail,
      }));

      registerGetGrantDetailTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        grant_id: 99999,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.error).toBe("Grant not found");
      expect(response.status).toBe(404);
    });
  });

  describe("error handling", () => {
    it("should handle missing API key", async () => {
      const envWithoutKey: Env = {
        ...mockEnv,
        TANGO_API_KEY: undefined as any,
      };

      registerGetGrantDetailTool(mockServer, envWithoutKey);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        grant_id: 12345,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.error).toContain("API key required");
      expect(response.error_code).toBe("MISSING_API_KEY");
    });

    it("should handle unexpected errors", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGetGrantDetail = vi.fn().mockRejectedValue(
        new Error("Network failure")
      );

      (TangoApiClient as any).mockImplementation(() => ({
        getGrantDetail: mockGetGrantDetail,
      }));

      registerGetGrantDetailTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        grant_id: 12345,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.error).toContain("Network failure");
      expect(response.error_code).toBe("INTERNAL_ERROR");
    });
  });
});
