/**
 * Unit tests for get_tango_agency_analytics tool
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerGetAgencyAnalyticsTool } from "@/tools/get-agency-analytics";
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
    getAgencyContracts: vi.fn(),
  })),
}));

describe("get_tango_agency_analytics tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register with correct name", () => {
    registerGetAgencyAnalyticsTool(mockServer, mockEnv);

    expect(mockServer.tool).toHaveBeenCalledWith(
      "get_tango_agency_analytics",
      expect.stringContaining("spending analytics for a specific federal agency"),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should require agency_code parameter", () => {
    registerGetAgencyAnalyticsTool(mockServer, mockEnv);

    const callArgs = (mockServer.tool as any).mock.calls[0];
    const schema = callArgs[2];

    expect(schema).toHaveProperty("agency_code");
  });

  it("should support fiscal year filtering", () => {
    registerGetAgencyAnalyticsTool(mockServer, mockEnv);

    const callArgs = (mockServer.tool as any).mock.calls[0];
    const schema = callArgs[2];

    expect(schema).toHaveProperty("fiscal_year");
  });

  it("should return error when agency_code is missing", async () => {
    registerGetAgencyAnalyticsTool(mockServer, mockEnv);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    const result = await handler({});

    const data = JSON.parse(result.content[0].text);
    expect(data.error_code).toBe("MISSING_AGENCY_CODE");
  });

  it("should return error when API key is missing", async () => {
    const envWithoutKey: Env = {
      TANGO_CACHE: {} as KVNamespace,
    };

    registerGetAgencyAnalyticsTool(mockServer, envWithoutKey);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    const result = await handler({ agency_code: "DOD" });

    const data = JSON.parse(result.content[0].text);
    expect(data.error_code).toBe("MISSING_API_KEY");
  });

  it("should aggregate agency spending by vendor", async () => {
    const { TangoApiClient } = await import("@/api/tango-client");
    const mockContracts = [
      {
        recipient: { display_name: "Vendor A", uei: "ABC123456789" },
        obligated: 1000000,
        awarding_office: { agency_name: "Department of Defense", agency_code: "DOD" },
        naics_code: "541512",
        naics_description: "Computer Systems Design",
        award_date: "2024-01-15",
        key: "CONT_1",
      },
      {
        recipient: { display_name: "Vendor A", uei: "ABC123456789" },
        obligated: 500000,
        awarding_office: { agency_name: "Department of Defense", agency_code: "DOD" },
        naics_code: "541512",
        naics_description: "Computer Systems Design",
        award_date: "2024-02-20",
        key: "CONT_2",
      },
      {
        recipient: { display_name: "Vendor B", uei: "DEF987654321" },
        obligated: 750000,
        awarding_office: { agency_name: "Department of Defense", agency_code: "DOD" },
        naics_code: "541511",
        naics_description: "Custom Computer Programming",
        award_date: "2024-03-10",
        key: "CONT_3",
      },
    ];

    const mockGetAgencyContracts = vi.fn().mockResolvedValue({
      success: true,
      data: { results: mockContracts, total: 3 },
      status: 200,
    });

    (TangoApiClient as any).mockImplementation(() => ({
      getAgencyContracts: mockGetAgencyContracts,
    }));

    registerGetAgencyAnalyticsTool(mockServer, mockEnv);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    const result = await handler({
      agency_code: "DOD",
      fiscal_year: 2024,
    });

    const data = JSON.parse(result.content[0].text);

    // Verify structure
    expect(data).toHaveProperty("agency_code", "DOD");
    expect(data).toHaveProperty("total_contracts", 3);
    expect(data).toHaveProperty("total_obligated", 2250000);
    expect(data).toHaveProperty("top_vendors");
    expect(data).toHaveProperty("top_naics");

    // Verify top vendors aggregation
    expect(data.top_vendors).toHaveLength(2);
    expect(data.top_vendors[0]).toMatchObject({
      rank: 1,
      vendor_name: "Vendor A",
      vendor_uei: "ABC123456789",
      total_obligated: 1500000,
      contract_count: 2,
    });

    // Verify API was called correctly
    expect(mockGetAgencyContracts).toHaveBeenCalledWith(
      "DOD",
      "awarding",
      expect.objectContaining({
        fiscal_year: 2024,
        limit: 100,
        ordering: "-award_amount",
      }),
      "test-api-key"
    );
  });

  it("should aggregate by NAICS codes", async () => {
    const { TangoApiClient } = await import("@/api/tango-client");
    const mockContracts = [
      {
        recipient: { display_name: "Vendor A", uei: "ABC" },
        obligated: 1000000,
        awarding_office: { agency_name: "DOD", agency_code: "DOD" },
        naics_code: "541512",
        naics_description: "Computer Systems Design",
        award_date: "2024-01-15",
        key: "CONT_A",
      },
      {
        recipient: { display_name: "Vendor B", uei: "DEF" },
        obligated: 500000,
        awarding_office: { agency_name: "DOD", agency_code: "DOD" },
        naics_code: "541512",
        naics_description: "Computer Systems Design",
        award_date: "2024-02-20",
        key: "CONT_B",
      },
    ];

    const mockGetAgencyContracts = vi.fn().mockResolvedValue({
      success: true,
      data: { results: mockContracts, total: 2 },
      status: 200,
    });

    (TangoApiClient as any).mockImplementation(() => ({
      getAgencyContracts: mockGetAgencyContracts,
    }));

    registerGetAgencyAnalyticsTool(mockServer, mockEnv);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    const result = await handler({
      agency_code: "DOD",
    });

    const data = JSON.parse(result.content[0].text);

    expect(data.top_naics).toHaveLength(1);
    expect(data.top_naics[0]).toMatchObject({
      rank: 1,
      naics_code: "541512",
      naics_description: "Computer Systems Design",
      total_obligated: 1500000,
      contract_count: 2,
    });
  });

  it("should include monthly trends when requested", async () => {
    const { TangoApiClient } = await import("@/api/tango-client");
    const mockContracts = [
      {
        recipient: { display_name: "Vendor A", uei: "ABC" },
        obligated: 1000000,
        awarding_office: { agency_name: "DOD", agency_code: "DOD" },
        naics_code: "541512",
        naics_description: "Computer Systems Design",
        award_date: "2024-01-15",
        key: "CONT_X",
      },
      {
        recipient: { display_name: "Vendor B", uei: "DEF" },
        obligated: 500000,
        awarding_office: { agency_name: "DOD", agency_code: "DOD" },
        naics_code: "541512",
        naics_description: "Computer Systems Design",
        award_date: "2024-02-20",
        key: "CONT_Y",
      },
    ];

    const mockGetAgencyContracts = vi.fn().mockResolvedValue({
      success: true,
      data: { results: mockContracts, total: 2 },
      status: 200,
    });

    (TangoApiClient as any).mockImplementation(() => ({
      getAgencyContracts: mockGetAgencyContracts,
    }));

    registerGetAgencyAnalyticsTool(mockServer, mockEnv);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    const result = await handler({
      agency_code: "DOD",
      include_trends: true,
    });

    const data = JSON.parse(result.content[0].text);

    expect(data).toHaveProperty("spending_by_month");
    expect(data.spending_by_month).toHaveLength(2);
    expect(data.spending_by_month[0]).toMatchObject({
      month: "2024-01",
      total_obligated: 1000000,
      contract_count: 1,
    });
    expect(data.spending_by_month[1]).toMatchObject({
      month: "2024-02",
      total_obligated: 500000,
      contract_count: 1,
    });
  });

  it("should handle no data found", async () => {
    const { TangoApiClient } = await import("@/api/tango-client");

    const mockGetAgencyContracts = vi.fn().mockResolvedValue({
      success: true,
      data: { results: [], total: 0 },
      status: 200,
    });

    (TangoApiClient as any).mockImplementation(() => ({
      getAgencyContracts: mockGetAgencyContracts,
    }));

    registerGetAgencyAnalyticsTool(mockServer, mockEnv);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    const result = await handler({
      agency_code: "INVALID",
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.error_code).toBe("NO_DATA");
  });

  it("should handle API errors", async () => {
    const { TangoApiClient } = await import("@/api/tango-client");

    const mockGetAgencyContracts = vi.fn().mockResolvedValue({
      success: false,
      error: "Agency not found",
      status: 404,
    });

    (TangoApiClient as any).mockImplementation(() => ({
      getAgencyContracts: mockGetAgencyContracts,
    }));

    registerGetAgencyAnalyticsTool(mockServer, mockEnv);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    const result = await handler({
      agency_code: "INVALID",
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.error_code).toBe("API_ERROR");
    expect(data.error).toBe("Agency not found");
  });
});
