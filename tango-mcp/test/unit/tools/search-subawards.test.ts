/**
 * Unit Tests for Search Subawards Tool
 *
 * Tests the search_tango_subawards tool registration and parameter handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerSearchSubawardsTool } from "@/tools/search-subawards";
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
		searchSubawards: vi.fn(),
	})),
}));

describe("search_tango_subawards tool", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("registration", () => {
		it("should register with correct name and description", () => {
			registerSearchSubawardsTool(mockServer, mockEnv);

			expect(mockServer.tool).toHaveBeenCalledWith(
				"search_subawards",
				expect.stringContaining("FSRS"),
				expect.any(Object),
				expect.any(Function),
			);
		});

		it("should define all expected parameters", () => {
			registerSearchSubawardsTool(mockServer, mockEnv);

			const callArgs = (mockServer.tool as any).mock.calls[0];
			const schema = callArgs[2];

			expect(schema).toHaveProperty("award_key");
			expect(schema).toHaveProperty("prime_uei");
			expect(schema).toHaveProperty("sub_uei");
			expect(schema).toHaveProperty("awarding_agency");
			expect(schema).toHaveProperty("funding_agency");
			expect(schema).toHaveProperty("recipient");
			expect(schema).toHaveProperty("fiscal_year");
			expect(schema).toHaveProperty("fiscal_year_start");
			expect(schema).toHaveProperty("fiscal_year_end");
			expect(schema).toHaveProperty("limit");
			expect(schema).toHaveProperty("page");
		});
	});

	describe("parameter handling", () => {
		it("should handle fiscal year exact parameter", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchSubawards = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchSubawards: mockSearchSubawards,
			}));

			registerSearchSubawardsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({ fiscal_year: 2024, limit: 10 });

			expect(mockSearchSubawards).toHaveBeenCalledWith(
				expect.objectContaining({
					fiscal_year_gte: "2024",
					fiscal_year_lte: "2024",
					limit: 10,
				}),
				expect.any(String),
			);
		});

		it("should handle fiscal year range parameters", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchSubawards = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchSubawards: mockSearchSubawards,
			}));

			registerSearchSubawardsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				fiscal_year_start: 2022,
				fiscal_year_end: 2024,
				limit: 10
			});

			expect(mockSearchSubawards).toHaveBeenCalledWith(
				expect.objectContaining({
					fiscal_year_gte: "2022",
					fiscal_year_lte: "2024",
					limit: 10,
				}),
				expect.any(String),
			);
		});

		it("should handle page parameter for offset pagination", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchSubawards = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchSubawards: mockSearchSubawards,
			}));

			registerSearchSubawardsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({ page: 2, limit: 25 });

			expect(mockSearchSubawards).toHaveBeenCalledWith(
				expect.objectContaining({
					page: 2,
					limit: 25,
				}),
				expect.any(String),
			);
		});

		it("should use default limit of 25", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchSubawards = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchSubawards: mockSearchSubawards,
			}));

			registerSearchSubawardsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({ award_key: "TEST_AWARD" });

			expect(mockSearchSubawards).toHaveBeenCalledWith(
				expect.objectContaining({
					limit: 25,
				}),
				expect.any(String),
			);
		});
	});

	describe("response normalization", () => {
		it("should normalize subaward data", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchSubawards = vi.fn().mockResolvedValue({
				success: true,
				data: {
					results: [
						{
							key: "SUB_001",
							subaward_number: "SUB-2024-001",
							award_key: "CONT_AWD_TEST",
							prime_recipient: {
								name: "Prime Contractor Inc",
								uei: "PRIMEUEI12345",
							},
							sub_recipient: {
								name: "Small Business LLC",
								uei: "SUBUEI123456",
								duns: "123456789",
							},
							subaward_amount: 50000,
							subaward_date: "2024-01-15",
						},
					],
					total: 1,
					next: null,
					previous: null,
				},
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchSubawards: mockSearchSubawards,
			}));

			registerSearchSubawardsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			const result = await handler({ limit: 10 });
			const data = JSON.parse(result.content[0].text);

			expect(data.data).toHaveLength(1);
			expect(data.data[0]).toHaveProperty("subaward_id", "SUB_001");
			expect(data.data[0]).toHaveProperty("prime_contractor");
			expect(data.data[0]).toHaveProperty("subcontractor");
			expect(data.data[0].prime_contractor.name).toBe("Prime Contractor Inc");
			expect(data.data[0].subcontractor.name).toBe("Small Business LLC");
		});
	});

	describe("pagination metadata", () => {
		it("should extract page numbers from URLs", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchSubawards = vi.fn().mockResolvedValue({
				success: true,
				data: {
					results: [],
					total: 100,
					next: "https://api.test.com/subawards/?page=3&limit=25",
					previous: "https://api.test.com/subawards/?page=1&limit=25",
				},
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchSubawards: mockSearchSubawards,
			}));

			registerSearchSubawardsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			const result = await handler({ page: 2, limit: 25 });
			const data = JSON.parse(result.content[0].text);

			expect(data.pagination).toHaveProperty("next_page", 3);
			expect(data.pagination).toHaveProperty("previous_page", 1);
			expect(data.pagination).toHaveProperty("current_page", 2);
			expect(data.pagination).toHaveProperty("has_more", true);
			expect(data.pagination).toHaveProperty("has_previous", true);
		});

		it("should set has_previous correctly based on current page", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");

			// Test page 1 - should be false
			const mockSearchSubawardsPage1 = vi.fn().mockResolvedValue({
				success: true,
				data: {
					results: [],
					total: 100,
					next: "https://api.test.com/subawards/?page=2&limit=25",
					previous: null,
				},
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchSubawards: mockSearchSubawardsPage1,
			}));

			registerSearchSubawardsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			const resultPage1 = await handler({ page: 1, limit: 25 });
			const dataPage1 = JSON.parse(resultPage1.content[0].text);

			expect(dataPage1.pagination.current_page).toBe(1);
			expect(dataPage1.pagination.has_previous).toBe(false);

			// Test page 2 - should be true
			vi.clearAllMocks();
			const mockSearchSubawardsPage2 = vi.fn().mockResolvedValue({
				success: true,
				data: {
					results: [],
					total: 100,
					next: "https://api.test.com/subawards/?page=3&limit=25",
					previous: "https://api.test.com/subawards/?page=1&limit=25",
				},
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchSubawards: mockSearchSubawardsPage2,
			}));

			registerSearchSubawardsTool(mockServer, mockEnv);
			const handler2 = (mockServer.tool as any).mock.calls[0][3];

			const resultPage2 = await handler2({ page: 2, limit: 25 });
			const dataPage2 = JSON.parse(resultPage2.content[0].text);

			expect(dataPage2.pagination.current_page).toBe(2);
			expect(dataPage2.pagination.has_previous).toBe(true);
		});
	});
});
