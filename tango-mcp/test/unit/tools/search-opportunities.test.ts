/**
 * Unit tests for search_tango_opportunities tool
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerSearchOpportunitiesTool } from "@/tools/search-opportunities";
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
    searchOpportunities: vi.fn(),
  })),
}));

describe("search_tango_opportunities tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register with correct name", () => {
    registerSearchOpportunitiesTool(mockServer, mockEnv);

    expect(mockServer.tool).toHaveBeenCalledWith(
      "search_opportunities",
      expect.stringContaining("federal contract opportunities"),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should call API with correct parameters", async () => {
    const { TangoApiClient } = await import("@/api/tango-client");
    const mockSearchOpportunities = vi.fn().mockResolvedValue({
      success: true,
      data: { results: [], total: 0 },
      status: 200,
    });

    (TangoApiClient as any).mockImplementation(() => ({
      searchOpportunities: mockSearchOpportunities,
    }));

    registerSearchOpportunitiesTool(mockServer, mockEnv);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    await handler({
      query: "cybersecurity",
      active: true,
      limit: 10,
    });

    expect(mockSearchOpportunities).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "cybersecurity",
        active: true,
        limit: 10,
      }),
      "test-api-key"
    );
  });

  it("should handle missing API key", async () => {
    const envWithoutKey: Env = {
      TANGO_CACHE: {} as KVNamespace,
    };

    registerSearchOpportunitiesTool(mockServer, envWithoutKey);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    const result = await handler({ limit: 10 });

    const data = JSON.parse(result.content[0].text);
    expect(data.error_code).toBe("MISSING_API_KEY");
  });

  it("should format response correctly", async () => {
    const { TangoApiClient } = await import("@/api/tango-client");
    const mockSearchOpportunities = vi.fn().mockResolvedValue({
      success: true,
      data: {
        results: [{ solicitation_number: "ABC-123" }],
        total: 1,
      },
      status: 200,
    });

    (TangoApiClient as any).mockImplementation(() => ({
      searchOpportunities: mockSearchOpportunities,
    }));

    registerSearchOpportunitiesTool(mockServer, mockEnv);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    const result = await handler({ limit: 10 });

    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveProperty("data");
    expect(data).toHaveProperty("total");
    expect(data).toHaveProperty("execution");
  });

  it("should handle active=true filter", async () => {
    const { TangoApiClient } = await import("@/api/tango-client");
    const mockSearchOpportunities = vi.fn().mockResolvedValue({
      success: true,
      data: { results: [], total: 0 },
      status: 200,
    });

    (TangoApiClient as any).mockImplementation(() => ({
      searchOpportunities: mockSearchOpportunities,
    }));

    registerSearchOpportunitiesTool(mockServer, mockEnv);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    await handler({ active: true, limit: 10 });

    expect(mockSearchOpportunities).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
        limit: 10,
      }),
      "test-api-key"
    );
  });

  it("should handle active=false filter", async () => {
    const { TangoApiClient } = await import("@/api/tango-client");
    const mockSearchOpportunities = vi.fn().mockResolvedValue({
      success: true,
      data: { results: [], total: 0 },
      status: 200,
    });

    (TangoApiClient as any).mockImplementation(() => ({
      searchOpportunities: mockSearchOpportunities,
    }));

    registerSearchOpportunitiesTool(mockServer, mockEnv);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    await handler({ active: false, limit: 10 });

    expect(mockSearchOpportunities).toHaveBeenCalledWith(
      expect.objectContaining({
        active: false,
        limit: 10,
      }),
      "test-api-key"
    );
  });

  it("should handle active=undefined (all opportunities)", async () => {
    const { TangoApiClient } = await import("@/api/tango-client");
    const mockSearchOpportunities = vi.fn().mockResolvedValue({
      success: true,
      data: { results: [], total: 0 },
      status: 200,
    });

    (TangoApiClient as any).mockImplementation(() => ({
      searchOpportunities: mockSearchOpportunities,
    }));

    registerSearchOpportunitiesTool(mockServer, mockEnv);
    const handler = (mockServer.tool as any).mock.calls[0][3];

    await handler({ limit: 10 });

    // active should not be included in params when undefined
    expect(mockSearchOpportunities).toHaveBeenCalledWith(
      expect.not.objectContaining({
        active: expect.anything(),
      }),
      "test-api-key"
    );
  });
});
