/**
 * Unit tests for search_tango_grants tool
 *
 * Tests:
 * - Opportunity-specific parameter handling
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
        expect.stringContaining("Grants.gov"),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it("should define opportunity-specific parameters", () => {
      registerSearchGrantsTool(mockServer, mockEnv);

      const callArgs = (mockServer.tool as any).mock.calls[0];
      const schema = callArgs[2];

      expect(schema).toHaveProperty("applicant_types");
      expect(schema).toHaveProperty("funding_categories");
      expect(schema).toHaveProperty("funding_instruments");
      expect(schema).toHaveProperty("status");
      expect(schema).toHaveProperty("response_date_after");
      expect(schema).toHaveProperty("response_date_before");
    });

    it("should not have award-specific parameters", () => {
      registerSearchGrantsTool(mockServer, mockEnv);

      const callArgs = (mockServer.tool as any).mock.calls[0];
      const schema = callArgs[2];

      expect(schema).not.toHaveProperty("recipient_name");
      expect(schema).not.toHaveProperty("recipient_uei");
      expect(schema).not.toHaveProperty("award_amount_min");
      expect(schema).not.toHaveProperty("award_amount_max");
    });
  });

  describe("opportunity filtering", () => {
    it("should filter by applicant types", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockOpportunities = [
        {
          grant_id: 1,
          opportunity_number: "ED-001",
          title: "Education Grant",
          applicant_types: [
            { code: "IHE", description: "Higher Education" },
          ],
        },
      ];

      const mockSearchGrants = vi.fn().mockResolvedValue({
        success: true,
        data: { results: mockOpportunities, total: 1 },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        searchGrants: mockSearchGrants,
      }));

      registerSearchGrantsTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      await handler({
        applicant_types: "IHE",
        limit: 10,
      });

      const callParams = mockSearchGrants.mock.calls[0][0];
      expect(callParams.applicant_types).toBe("IHE");
    });

    it("should filter by funding instruments", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockOpportunities = [
        {
          grant_id: 1,
          opportunity_number: "NSF-001",
          title: "Research Grant",
          funding_instruments: [{ code: "G", description: "Grant" }],
        },
      ];

      const mockSearchGrants = vi.fn().mockResolvedValue({
        success: true,
        data: { results: mockOpportunities, total: 1 },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        searchGrants: mockSearchGrants,
      }));

      registerSearchGrantsTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      await handler({
        funding_instruments: "G,CA",
        limit: 10,
      });

      const callParams = mockSearchGrants.mock.calls[0][0];
      expect(callParams.funding_instruments).toBe("G,CA");
    });

    it("should filter by status (Posted/Forecasted)", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockOpportunities = [
        {
          grant_id: 1,
          opportunity_number: "HHS-001",
          title: "Health Grant",
          status: { code: "P", description: "Posted" },
        },
      ];

      const mockSearchGrants = vi.fn().mockResolvedValue({
        success: true,
        data: { results: mockOpportunities, total: 1 },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        searchGrants: mockSearchGrants,
      }));

      registerSearchGrantsTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      await handler({
        status: "P",
        limit: 10,
      });

      const callParams = mockSearchGrants.mock.calls[0][0];
      expect(callParams.status).toBe("P");
    });

    it("should filter by response deadline range", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockOpportunities = [
        {
          grant_id: 1,
          opportunity_number: "DOE-001",
          title: "Energy Grant",
          important_dates: {
            response_date: "2024-12-31",
          },
        },
      ];

      const mockSearchGrants = vi.fn().mockResolvedValue({
        success: true,
        data: { results: mockOpportunities, total: 1 },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        searchGrants: mockSearchGrants,
      }));

      registerSearchGrantsTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      await handler({
        response_date_after: "2024-12-01",
        response_date_before: "2024-12-31",
        limit: 10,
      });

      const callParams = mockSearchGrants.mock.calls[0][0];
      expect(callParams.response_date_after).toBe("2024-12-01");
      expect(callParams.response_date_before).toBe("2024-12-31");
    });
  });

  describe("API integration", () => {
    it("should send all opportunity parameters to API", async () => {
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
        agency: "ED",
        cfda_number: "84.027",
        applicant_types: "IHE,NP",
        funding_categories: "ED",
        funding_instruments: "G",
        status: "P",
        ordering: "-response_date",
        limit: 10,
      });

      const callParams = mockSearchGrants.mock.calls[0][0];
      expect(callParams.search).toBe("education");
      expect(callParams.agency).toBe("ED");
      expect(callParams.cfda_number).toBe("84.027");
      expect(callParams.applicant_types).toBe("IHE,NP");
      expect(callParams.funding_categories).toBe("ED");
      expect(callParams.funding_instruments).toBe("G");
      expect(callParams.status).toBe("P");
      expect(callParams.ordering).toBe("-response_date");
    });

    it("should handle NAICS and PSC codes", async () => {
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
        naics_code: "541512",
        psc_code: "R425",
        limit: 10,
      });

      const callParams = mockSearchGrants.mock.calls[0][0];
      expect(callParams.naics_code).toBe("541512");
      expect(callParams.psc_code).toBe("R425");
    });
  });

  describe("response formatting", () => {
    it("should normalize opportunity data correctly", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockOpportunities = [
        {
          grant_id: 358865,
          opportunity_number: "DOTBAB01062025",
          title: "Transportation Safety Grant",
          agency_code: "DOT",
          status: { code: "P", description: "Posted" },
          important_dates: {
            posted_date: "2024-01-15",
            response_date: "2024-12-31",
          },
          cfda_numbers: [
            { number: "20.600", title: "State and Community Highway Safety" },
          ],
          funding_details: {
            award_ceiling: 1000000,
            award_floor: 100000,
            estimated_total_funding: 5000000,
          },
        },
      ];

      const mockSearchGrants = vi.fn().mockResolvedValue({
        success: true,
        data: { results: mockOpportunities, total: 1, next: null },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        searchGrants: mockSearchGrants,
      }));

      registerSearchGrantsTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({ limit: 10 });

      const data = JSON.parse(result.content[0].text);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].opportunity_number).toBe("DOTBAB01062025");
      expect(data.data[0].status.code).toBe("P");
      expect(data.data[0].cfda_numbers).toHaveLength(1);
      expect(data.data[0].funding.ceiling).toBe(1000000);
    });

    it("should not include client_side_filters metadata", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockSearchGrants = vi.fn().mockResolvedValue({
        success: true,
        data: { results: [], total: 0, next: null },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        searchGrants: mockSearchGrants,
      }));

      registerSearchGrantsTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({ query: "education" });

      const data = JSON.parse(result.content[0].text);
      expect(data.client_side_filters).toBeUndefined();
    });

    it("should use next URL for pagination", async () => {
      const { TangoApiClient } = await import("@/api/tango-client");
      const mockSearchGrants = vi.fn().mockResolvedValue({
        success: true,
        data: {
          results: [],
          total: 100,
          next: "https://tango.makegov.com/api/grants/?page=2",
        },
        status: 200,
      });

      (TangoApiClient as any).mockImplementation(() => ({
        searchGrants: mockSearchGrants,
      }));

      registerSearchGrantsTool(mockServer, mockEnv);
      const handler = (mockServer.tool as any).mock.calls[0][3];

      const result = await handler({ limit: 10 });

      const data = JSON.parse(result.content[0].text);
      expect(data.pagination.has_more).toBe(true);
      expect(data.pagination.next_page).toBe(
        "https://tango.makegov.com/api/grants/?page=2"
      );
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
