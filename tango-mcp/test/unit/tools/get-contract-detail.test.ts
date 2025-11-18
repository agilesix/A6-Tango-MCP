/**
 * Unit tests for get_tango_contract_detail tool
 *
 * Tests:
 * - Parameter validation
 * - API client integration
 * - Response formatting
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerGetContractDetailTool } from "@/tools/get-contract-detail";
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
    getContractDetail: vi.fn(),
  })),
}));

describe("get_tango_contract_detail tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registration", () => {
    it("should register with correct name and description", () => {
      registerGetContractDetailTool(mockServer, mockEnv);

      expect(mockServer.tool).toHaveBeenCalledWith(
        "get_tango_contract_detail",
        expect.stringContaining("detailed information for a specific federal contract"),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it("should define contract_key parameter", () => {
      registerGetContractDetailTool(mockServer, mockEnv);

      const callArgs = (mockServer.tool as any).mock.calls[0];
      const schema = callArgs[2];

      expect(schema).toHaveProperty("contract_key");
    });
  });

  describe("parameter validation", () => {
    it("should require contract_key parameter", async () => {
      registerGetContractDetailTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({});

      expect(result.content[0].text).toContain("contract_key parameter is required");
    });

    it("should accept valid contract key", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGetContractDetail = vi.fn().mockResolvedValue({
        success: true,
        data: { key: "CONT_AWD_12345", piid: "12345" },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        getContractDetail: mockGetContractDetail,
      }));

      registerGetContractDetailTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      await handler({
        contract_key: "CONT_AWD_12345",
      });

      expect(mockGetContractDetail).toHaveBeenCalledWith(
        "CONT_AWD_12345",
        "test-api-key"
      );
    });
  });

  describe("API integration", () => {
    it("should handle successful API response", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockData = {
        key: "CONT_AWD_12345",
        piid: "12345",
        description: "Test contract",
        total_contract_value: 100000,
      };

      const mockGetContractDetail = vi.fn().mockResolvedValue({
        success: true,
        data: mockData,
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        getContractDetail: mockGetContractDetail,
      }));

      registerGetContractDetailTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        contract_key: "CONT_AWD_12345",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.data).toEqual(mockData);
      expect(response.contract_key).toBe("CONT_AWD_12345");
      expect(response.execution).toHaveProperty("duration_ms");
    });

    it("should handle API error", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGetContractDetail = vi.fn().mockResolvedValue({
        success: false,
        error: "Contract not found",
        status: 404,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        getContractDetail: mockGetContractDetail,
      }));

      registerGetContractDetailTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        contract_key: "CONT_AWD_INVALID",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.error).toBe("Contract not found");
      expect(response.status).toBe(404);
    });
  });

  describe("error handling", () => {
    it("should handle missing API key", async () => {
      const envWithoutKey: Env = {
        ...mockEnv,
        TANGO_API_KEY: undefined as any,
      };

      registerGetContractDetailTool(mockServer, envWithoutKey);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        contract_key: "CONT_AWD_12345",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.error).toContain("API key required");
      expect(response.error_code).toBe("MISSING_API_KEY");
    });

    it("should handle unexpected errors", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGetContractDetail = vi.fn().mockRejectedValue(
        new Error("Network failure")
      );

      (TangoApiClient as any).mockImplementation(() => ({
        getContractDetail: mockGetContractDetail,
      }));

      registerGetContractDetailTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        contract_key: "CONT_AWD_12345",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.error).toContain("Network failure");
      expect(response.error_code).toBe("INTERNAL_ERROR");
    });
  });
});
