/**
 * Unit tests for get_tango_opportunity_detail tool
 *
 * Tests:
 * - Parameter validation
 * - API client integration
 * - Response formatting
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerGetOpportunityDetailTool } from "@/tools/get-opportunity-detail";
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
    getOpportunityDetail: vi.fn(),
  })),
}));

describe("get_tango_opportunity_detail tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registration", () => {
    it("should register with correct name and description", () => {
      registerGetOpportunityDetailTool(mockServer, mockEnv);

      expect(mockServer.tool).toHaveBeenCalledWith(
        "get_tango_opportunity_detail",
        expect.stringContaining("detailed information for a specific federal contract opportunity"),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it("should define opportunity_id parameter", () => {
      registerGetOpportunityDetailTool(mockServer, mockEnv);

      const callArgs = (mockServer.tool as any).mock.calls[0];
      const schema = callArgs[2];

      expect(schema).toHaveProperty("opportunity_id");
    });
  });

  describe("parameter validation", () => {
    it("should require opportunity_id parameter", async () => {
      registerGetOpportunityDetailTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({});

      expect(result.content[0].text).toContain("opportunity_id parameter is required");
    });

    it("should accept valid opportunity ID (UUID)", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const testUuid = "a924c349-fa2a-4742-ac02-8075dee1c85d";
      const mockGetOpportunityDetail = vi.fn().mockResolvedValue({
        success: true,
        data: { opportunity_id: testUuid, title: "Test Opportunity" },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        getOpportunityDetail: mockGetOpportunityDetail,
      }));

      registerGetOpportunityDetailTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      await handler({
        opportunity_id: testUuid,
      });

      expect(mockGetOpportunityDetail).toHaveBeenCalledWith(testUuid, "test-api-key");
    });
  });

  describe("API integration", () => {
    it("should handle successful API response", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const testUuid = "a924c349-fa2a-4742-ac02-8075dee1c85d";
      const mockData = {
        opportunity_id: testUuid,
        title: "Test Contract Opportunity",
        solicitation_number: "TEST-2024-001",
        description: "Test opportunity description",
      };

      const mockGetOpportunityDetail = vi.fn().mockResolvedValue({
        success: true,
        data: mockData,
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        getOpportunityDetail: mockGetOpportunityDetail,
      }));

      registerGetOpportunityDetailTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        opportunity_id: testUuid,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.data).toEqual(mockData);
      expect(response.opportunity_id).toBe(testUuid);
      expect(response.execution).toHaveProperty("duration_ms");
    });

    it("should handle API error", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const testUuid = "a924c349-fa2a-4742-ac02-8075dee1c85d";
      const mockGetOpportunityDetail = vi.fn().mockResolvedValue({
        success: false,
        error: "Opportunity not found",
        status: 404,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        getOpportunityDetail: mockGetOpportunityDetail,
      }));

      registerGetOpportunityDetailTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        opportunity_id: testUuid,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.error).toBe("Opportunity not found");
      expect(response.status).toBe(404);
    });
  });

  describe("error handling", () => {
    it("should handle missing API key", async () => {
      const envWithoutKey: Env = {
        ...mockEnv,
        TANGO_API_KEY: undefined as any,
      };
      const testUuid = "a924c349-fa2a-4742-ac02-8075dee1c85d";

      registerGetOpportunityDetailTool(mockServer, envWithoutKey);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        opportunity_id: testUuid,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.error).toContain("API key required");
      expect(response.error_code).toBe("MISSING_API_KEY");
    });

    it("should handle unexpected errors", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const testUuid = "a924c349-fa2a-4742-ac02-8075dee1c85d";
      const mockGetOpportunityDetail = vi.fn().mockRejectedValue(
        new Error("Network failure")
      );

      (TangoApiClient as any).mockImplementation(() => ({
        getOpportunityDetail: mockGetOpportunityDetail,
      }));

      registerGetOpportunityDetailTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        opportunity_id: testUuid,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.error).toContain("Network failure");
      expect(response.error_code).toBe("INTERNAL_ERROR");
    });
  });
});
