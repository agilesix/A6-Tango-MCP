/**
 * Unit tests for get_tango_vendor_profile tool
 *
 * Tests:
 * - Required parameter validation (UEI)
 * - UEI format validation
 * - Optional include_history parameter
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerGetVendorProfileTool } from "@/tools/get-vendor-profile";
import type { Env } from "@/types/env";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const mockEnv: Env = {
  TANGO_API_KEY: "test-api-key",
  TANGO_CACHE: {} as KVNamespace,
};

const mockServer = {
  tool: vi.fn(),
} as unknown as McpServer;

vi.mock("@/api/tango-client", () => ({
  TangoApiClient: vi.fn().mockImplementation(() => ({
    getVendorProfile: vi.fn(),
    searchContracts: vi.fn(),
  })),
}));

describe("get_tango_vendor_profile tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registration", () => {
    it("should register with correct name", () => {
      registerGetVendorProfileTool(mockServer, mockEnv);

      expect(mockServer.tool).toHaveBeenCalledWith(
        "get_vendor_profile",
        expect.stringContaining("SAM.gov"),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it("should define required UEI parameter", () => {
      registerGetVendorProfileTool(mockServer, mockEnv);

      const callArgs = (mockServer.tool as any).mock.calls[0];
      const schema = callArgs[2];

      expect(schema).toHaveProperty("uei");
      expect(schema).toHaveProperty("include_history");
    });
  });

  describe("parameter validation", () => {
    it("should require UEI parameter", async () => {
      registerGetVendorProfileTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({});

      const data = JSON.parse(result.content[0].text);
      expect(data.error_code).toBe("MISSING_PARAMETER");
      expect(data.parameter).toBe("uei");
    });

    it("should accept valid 12-character UEI", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGetVendorProfile = vi.fn().mockResolvedValue({
        success: true,
        data: { uei: "J3RW5C5KVLZ1", legal_business_name: "Test Corp" },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        getVendorProfile: mockGetVendorProfile,
        searchContracts: vi.fn().mockResolvedValue({
          success: true,
          data: { results: [] },
        }),
      }));

      registerGetVendorProfileTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({ uei: "J3RW5C5KVLZ1" });

      expect(mockGetVendorProfile).toHaveBeenCalledWith(
        "J3RW5C5KVLZ1",
        "test-api-key"
      );
    });
  });

  describe("include_history parameter", () => {
    it("should fetch history when include_history is true", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGetVendorProfile = vi.fn().mockResolvedValue({
        success: true,
        data: { uei: "J3RW5C5KVLZ1", legal_business_name: "Test Corp" },
        status: 200,
      });
      const mockGetVendorContracts = vi.fn().mockResolvedValue({
        success: true,
        data: {
          results: [
            {
              piid: "CONTRACT-001",
              title: "IT Services",
              award_date: "2024-01-15",
              obligated: 1000000
            }
          ]
        },
        status: 200,
      });
      const mockGetVendorGrants = vi.fn().mockResolvedValue({
        success: true,
        data: {
          results: [
            {
              fain: "GRANT-001",
              title: "Research Grant",
              award_date: "2024-02-01",
              award_amount: 500000
            }
          ]
        },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        getVendorProfile: mockGetVendorProfile,
        getVendorContracts: mockGetVendorContracts,
        getVendorGrants: mockGetVendorGrants,
      }));

      registerGetVendorProfileTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        uei: "J3RW5C5KVLZ1",
        include_history: true,
      });

      // Verify history methods were called
      expect(mockGetVendorContracts).toHaveBeenCalledWith(
        "J3RW5C5KVLZ1",
        { limit: "10" },
        "test-api-key"
      );
      expect(mockGetVendorGrants).toHaveBeenCalledWith(
        "J3RW5C5KVLZ1",
        { limit: "10" },
        "test-api-key"
      );

      // Verify history is in response
      const data = JSON.parse(result.content[0].text);
      expect(data.data.contract_history).toBeDefined();
      expect(data.data.contract_history).toHaveLength(1);
      expect(data.data.contract_history[0].piid).toBe("CONTRACT-001");
      expect(data.data.subaward_history).toBeDefined();
      expect(data.data.subaward_history).toHaveLength(1);
      expect(data.data.subaward_history[0].award_id).toBe("GRANT-001");
      expect(data.execution.history_fetched).toBe(true);
      expect(data.execution.api_calls).toBe(3); // 1 profile + 2 history
    });

    it("should not fetch history when include_history is false", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGetVendorProfile = vi.fn().mockResolvedValue({
        success: true,
        data: { uei: "J3RW5C5KVLZ1", legal_business_name: "Test Corp" },
        status: 200,
      });
      const mockGetVendorContracts = vi.fn();
      const mockGetVendorGrants = vi.fn();

      (TangoApiClient as any).mockImplementation(() => ({
        getVendorProfile: mockGetVendorProfile,
        getVendorContracts: mockGetVendorContracts,
        getVendorGrants: mockGetVendorGrants,
      }));

      registerGetVendorProfileTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        uei: "J3RW5C5KVLZ1",
        include_history: false,
      });

      expect(mockGetVendorContracts).not.toHaveBeenCalled();
      expect(mockGetVendorGrants).not.toHaveBeenCalled();

      const data = JSON.parse(result.content[0].text);
      expect(data.data.contract_history).toBeUndefined();
      expect(data.data.subaward_history).toBeUndefined();
      expect(data.execution.history_fetched).toBe(false);
      expect(data.execution.api_calls).toBe(1); // Only profile
    });

    it("should use custom history_limit parameter", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGetVendorProfile = vi.fn().mockResolvedValue({
        success: true,
        data: { uei: "J3RW5C5KVLZ1" },
        status: 200,
      });
      const mockGetVendorContracts = vi.fn().mockResolvedValue({
        success: true,
        data: { results: [] },
        status: 200,
      });
      const mockGetVendorGrants = vi.fn().mockResolvedValue({
        success: true,
        data: { results: [] },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        getVendorProfile: mockGetVendorProfile,
        getVendorContracts: mockGetVendorContracts,
        getVendorGrants: mockGetVendorGrants,
      }));

      registerGetVendorProfileTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      await handler({
        uei: "J3RW5C5KVLZ1",
        include_history: true,
        history_limit: 25,
      });

      expect(mockGetVendorContracts).toHaveBeenCalledWith(
        "J3RW5C5KVLZ1",
        { limit: "25" },
        "test-api-key"
      );
      expect(mockGetVendorGrants).toHaveBeenCalledWith(
        "J3RW5C5KVLZ1",
        { limit: "25" },
        "test-api-key"
      );
    });

    it("should handle history fetch failures gracefully", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGetVendorProfile = vi.fn().mockResolvedValue({
        success: true,
        data: { uei: "J3RW5C5KVLZ1", legal_business_name: "Test Corp" },
        status: 200,
      });
      const mockGetVendorContracts = vi.fn().mockRejectedValue(
        new Error("Network error")
      );
      const mockGetVendorGrants = vi.fn().mockRejectedValue(
        new Error("Network error")
      );

      (TangoApiClient as any).mockImplementation(() => ({
        getVendorProfile: mockGetVendorProfile,
        getVendorContracts: mockGetVendorContracts,
        getVendorGrants: mockGetVendorGrants,
      }));

      registerGetVendorProfileTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({
        uei: "J3RW5C5KVLZ1",
        include_history: true,
      });

      // Profile should still succeed
      const data = JSON.parse(result.content[0].text);
      expect(data.data).toBeDefined();
      expect(data.data.legal_business_name).toBe("Test Corp");

      // History should be empty arrays (not undefined)
      expect(data.data.contract_history).toEqual([]);
      expect(data.data.subaward_history).toEqual([]);
    });
  });

  describe("federal_obligations", () => {
    it("should include federal_obligations in response when present in API data", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGetVendorProfile = vi.fn().mockResolvedValue({
        success: true,
        data: {
          uei: "J3RW5C5KVLZ1",
          legal_business_name: "Test Corp",
          federal_obligations: {
            active_contracts: { total_obligated: 5000000, count: 10 },
            total_contracts: { total_obligated: 15000000, count: 50 },
            active_subawards: { total_obligated: 1000000, count: 3 },
            total_subawards: { total_obligated: 3000000, count: 15 },
            active_idvs: { count: 2 },
            total_idvs: { count: 8 },
          },
        },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        getVendorProfile: mockGetVendorProfile,
      }));

      registerGetVendorProfileTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({ uei: "J3RW5C5KVLZ1" });

      const data = JSON.parse(result.content[0].text);
      expect(data.data.federal_obligations).toBeDefined();
      expect(data.data.federal_obligations.active_contracts).toEqual({
        total_obligated: 5000000,
        count: 10,
      });
      expect(data.data.federal_obligations.total_contracts).toEqual({
        total_obligated: 15000000,
        count: 50,
      });
    });

    it("should provide default federal_obligations when missing from API response", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGetVendorProfile = vi.fn().mockResolvedValue({
        success: true,
        data: {
          uei: "J3RW5C5KVLZ1",
          legal_business_name: "Test Corp",
          // No federal_obligations field
        },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        getVendorProfile: mockGetVendorProfile,
      }));

      registerGetVendorProfileTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({ uei: "J3RW5C5KVLZ1" });

      const data = JSON.parse(result.content[0].text);
      expect(data.data.federal_obligations).toBeDefined();
      expect(data.data.federal_obligations.active_contracts).toEqual({
        total_obligated: 0,
        count: 0,
      });
      expect(data.data.federal_obligations.total_contracts).toEqual({
        total_obligated: 0,
        count: 0,
      });
    });
  });

  describe("error handling", () => {
    it("should handle missing API key", async () => {
      const envWithoutKey: Env = {
        TANGO_CACHE: {} as KVNamespace,
      };

      registerGetVendorProfileTool(mockServer, envWithoutKey);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({ uei: "J3RW5C5KVLZ1" });

      const data = JSON.parse(result.content[0].text);
      expect(data.error_code).toBe("MISSING_API_KEY");
    });

    it("should handle API errors", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockGetVendorProfile = vi.fn().mockResolvedValue({
        success: false,
        error: "Vendor not found",
        status: 404,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        getVendorProfile: mockGetVendorProfile,
      }));

      registerGetVendorProfileTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({ uei: "NOTFOUND123" });

      const data = JSON.parse(result.content[0].text);
      expect(data.error_code).toBe("API_ERROR");
    });
  });
});
