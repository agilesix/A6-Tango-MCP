/**
 * Unit tests for get_tango_spending_summary tool
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerGetSpendingSummaryTool } from "@/tools/get-spending-summary";
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
    searchContracts: vi.fn(),
  })),
}));

describe("get_tango_spending_summary tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register with correct name", () => {
    registerGetSpendingSummaryTool(mockServer, mockEnv);

    expect(mockServer.tool).toHaveBeenCalledWith(
      "get_tango_spending_summary",
      expect.stringContaining("aggregated spending analytics"),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should support different aggregation dimensions", () => {
    registerGetSpendingSummaryTool(mockServer, mockEnv);

    const callArgs = (mockServer.tool as any).mock.calls[0];
    const schema = callArgs[2];

    expect(schema).toHaveProperty("group_by");
  });

  it("should aggregate spending data", async () => {
    const { TangoApiClient } = await import("@/api/tango-client");
    const mockContracts = [
      {
        recipient: { name: "Vendor A", uei: "ABC" },
        obligated: 100000,
        awarding_agency: { name: "DOD" },
        naics_code: "541512",
      },
      {
        recipient: { name: "Vendor A", uei: "ABC" },
        obligated: 200000,
        awarding_agency: { name: "DOD" },
        naics_code: "541512",
      },
      {
        recipient: { name: "Vendor B", uei: "DEF" },
        obligated: 150000,
        awarding_agency: { name: "NASA" },
        naics_code: "541511",
      },
    ];

    const mockSearchContracts = vi.fn().mockResolvedValue({
      success: true,
      data: { results: mockContracts, total: 3 },
      status: 200,
    });

    (TangoApiClient as any).mockImplementation(() => ({
      searchContracts: mockSearchContracts,
    }));

    registerGetSpendingSummaryTool(mockServer, mockEnv);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    const result = await handler({
      group_by: "vendor",
      limit: 100,
    });

    const data = JSON.parse(result.content[0].text);
    // Spending summary returns aggregated data
    expect(data).toBeDefined();
    expect(mockSearchContracts).toHaveBeenCalled();
  });

  it("should handle missing API key", async () => {
    const envWithoutKey: Env = {
      TANGO_CACHE: {} as KVNamespace,
    };

    registerGetSpendingSummaryTool(mockServer, envWithoutKey);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    const result = await handler({ group_by: "vendor" });

    const data = JSON.parse(result.content[0].text);
    expect(data.error_code).toBe("MISSING_API_KEY");
  });

  it("should filter by fiscal year", async () => {
    const { TangoApiClient } = await import("@/api/tango-client");
    const mockSearchContracts = vi.fn().mockResolvedValue({
      success: true,
      data: { results: [], total: 0 },
      status: 200,
    });

    (TangoApiClient as any).mockImplementation(() => ({
      searchContracts: mockSearchContracts,
    }));

    registerGetSpendingSummaryTool(mockServer, mockEnv);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    await handler({
      fiscal_year: 2024,
      group_by: "agency",
    });

    const callParams = mockSearchContracts.mock.calls[0][0];
    expect(callParams.award_date_gte).toBe("2023-10-01");
    expect(callParams.award_date_lte).toBe("2024-09-30");
  });
});
