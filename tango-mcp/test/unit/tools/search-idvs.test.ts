/**
 * Unit tests for search_tango_idvs tool
 *
 * Tests:
 * - Parameter transformation (arrays → pipes)
 * - NAICS comma/pipe conversion
 * - IDV type code validation and uppercase normalization
 * - recipient_name vs recipient_uei mapping
 * - Date range parameter mapping
 * - Fiscal year exact/range handling
 * - Response normalization
 * - IDV type code translation in normalized response
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerSearchIDVsTool } from "@/tools/search-idvs";
import type { Env } from "@/types/env";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { normalizeIDV } from "@/utils/normalizer";
import type { TangoIDVResponse } from "@/types/tango-api";

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
		searchIDVs: vi.fn(),
	})),
}));

describe("search_tango_idvs tool", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("registration", () => {
		it("should register with correct name and description", () => {
			registerSearchIDVsTool(mockServer, mockEnv);

			expect(mockServer.tool).toHaveBeenCalledWith(
				"search_idvs",
				expect.stringContaining("Indefinite Delivery Vehicles"),
				expect.any(Object),
				expect.any(Function),
			);
		});

		it("should define all expected parameters", () => {
			registerSearchIDVsTool(mockServer, mockEnv);

			const callArgs = (mockServer.tool as any).mock.calls[0];
			const schema = callArgs[2];

			expect(schema).toHaveProperty("query");
			expect(schema).toHaveProperty("recipient_name");
			expect(schema).toHaveProperty("recipient_uei");
			expect(schema).toHaveProperty("idv_type");
			expect(schema).toHaveProperty("awarding_agency");
			expect(schema).toHaveProperty("funding_agency");
			expect(schema).toHaveProperty("naics_code");
			expect(schema).toHaveProperty("psc_code");
			expect(schema).toHaveProperty("set_aside_type");
			expect(schema).toHaveProperty("award_date_start");
			expect(schema).toHaveProperty("award_date_end");
			expect(schema).toHaveProperty("fiscal_year");
			expect(schema).toHaveProperty("fiscal_year_start");
			expect(schema).toHaveProperty("fiscal_year_end");
			expect(schema).toHaveProperty("expiring_after");
			expect(schema).toHaveProperty("expiring_before");
			expect(schema).toHaveProperty("limit");
			expect(schema).toHaveProperty("ordering");
		});
	});

	describe("parameter transformation", () => {
		it("should convert NAICS array to pipe-separated string", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				naics_code: ["541512", "541511"],
				limit: 10,
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			expect(callParams.naics).toBe("541512|541511");
		});

		it("should convert comma-separated NAICS to pipe-separated", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				naics_code: "541512,541511",
				limit: 10,
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			expect(callParams.naics).toBe("541512|541511");
		});

		it("should convert IDV type array to pipe-separated uppercase", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				idv_type: ["a", "d"],
				limit: 10,
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			expect(callParams.idv_type).toBe("A|D");
		});

		it("should map recipient_name to recipient parameter", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				recipient_name: "Booz Allen",
				limit: 10,
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			expect(callParams.recipient).toBe("Booz Allen");
			expect(callParams.recipient_name).toBeUndefined();
		});

		it("should map recipient_uei to uei parameter", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				recipient_uei: "J3RW5C5KVLZ1",
				limit: 10,
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			expect(callParams.uei).toBe("J3RW5C5KVLZ1");
			expect(callParams.recipient_uei).toBeUndefined();
		});

		it("should convert PSC array to pipe-separated", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				psc_code: ["D302", "D307"],
				limit: 10,
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			expect(callParams.psc).toBe("D302|D307");
		});

		it("should convert set-aside array to pipe-separated uppercase", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				set_aside_type: ["8a", "sdvosb"],
				limit: 10,
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			expect(callParams.set_aside).toBe("8A|SDVOSB");
		});
	});

	describe("date range handling", () => {
		it("should map expiring_after to expiring_gte", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				expiring_after: "2024-01-01",
				limit: 10,
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			expect(callParams.expiring_gte).toBe("2024-01-01");
			expect(callParams.expiring_after).toBeUndefined();
		});

		it("should map expiring_before to expiring_lte", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				expiring_before: "2025-12-31",
				limit: 10,
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			expect(callParams.expiring_lte).toBe("2025-12-31");
			expect(callParams.expiring_before).toBeUndefined();
		});

		it("should map award_date_start to award_date_gte", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				award_date_start: "2024-01-01",
				limit: 10,
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			expect(callParams.award_date_gte).toBe("2024-01-01");
		});
	});

	describe("fiscal year handling", () => {
		it("should handle exact fiscal year", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				fiscal_year: 2024,
				limit: 10,
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			expect(callParams.fiscal_year_gte).toBe("2024");
			expect(callParams.fiscal_year_lte).toBe("2024");
		});

		it("should handle fiscal year range", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				fiscal_year_start: 2022,
				fiscal_year_end: 2024,
				limit: 10,
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			expect(callParams.fiscal_year_gte).toBe("2022");
			expect(callParams.fiscal_year_lte).toBe("2024");
		});
	});

	describe("IDV type code translation", () => {
		it("should translate code A to GWAC in normalized response", () => {
			const mockIDV: TangoIDVResponse = {
				key: "IDV_123",
				idv_type: {
					code: "A",
					description: "Some description",
				},
				recipient: {
					display_name: "Test Vendor",
					uei: "123456789012",
				},
			};

			const normalized = normalizeIDV(mockIDV);
			expect(normalized.idv_type.code).toBe("A");
			expect(normalized.idv_type.description).toBe(
				"GWAC (Government-Wide Acquisition Contract)",
			);
		});

		it("should translate code B to IDC in normalized response", () => {
			const mockIDV: TangoIDVResponse = {
				key: "IDV_123",
				idv_type: {
					code: "B",
				},
				recipient: {
					display_name: "Test Vendor",
				},
			};

			const normalized = normalizeIDV(mockIDV);
			expect(normalized.idv_type.code).toBe("B");
			expect(normalized.idv_type.description).toBe(
				"IDC (Indefinite Delivery Contract)",
			);
		});

		it("should translate code C to FSS in normalized response", () => {
			const mockIDV: TangoIDVResponse = {
				key: "IDV_123",
				idv_type: {
					code: "C",
				},
				recipient: {
					display_name: "Test Vendor",
				},
			};

			const normalized = normalizeIDV(mockIDV);
			expect(normalized.idv_type.code).toBe("C");
			expect(normalized.idv_type.description).toBe(
				"FSS (Federal Supply Schedule)",
			);
		});

		it("should translate code D to BOA in normalized response", () => {
			const mockIDV: TangoIDVResponse = {
				key: "IDV_123",
				idv_type: {
					code: "D",
				},
				recipient: {
					display_name: "Test Vendor",
				},
			};

			const normalized = normalizeIDV(mockIDV);
			expect(normalized.idv_type.code).toBe("D");
			expect(normalized.idv_type.description).toBe(
				"BOA (Basic Ordering Agreement)",
			);
		});

		it("should translate code E to BPA in normalized response", () => {
			const mockIDV: TangoIDVResponse = {
				key: "IDV_123",
				idv_type: {
					code: "E",
				},
				recipient: {
					display_name: "Test Vendor",
				},
			};

			const normalized = normalizeIDV(mockIDV);
			expect(normalized.idv_type.code).toBe("E");
			expect(normalized.idv_type.description).toBe(
				"BPA (Blanket Purchase Agreement)",
			);
		});

		it("should handle missing IDV type code", () => {
			const mockIDV: TangoIDVResponse = {
				key: "IDV_123",
				recipient: {
					display_name: "Test Vendor",
				},
			};

			const normalized = normalizeIDV(mockIDV);
			expect(normalized.idv_type.code).toBeNull();
			expect(normalized.idv_type.description).toBeNull();
		});
	});

	describe("response normalization", () => {
		it("should normalize IDV response with all fields", () => {
			const mockIDV: TangoIDVResponse = {
				key: "IDV_123",
				piid: "PIID123",
				description: "Test IDV",
				award_date: "2024-01-01",
				fiscal_year: 2024,
				idv_type: {
					code: "A",
					description: "GWAC",
				},
				recipient: {
					display_name: "Test Vendor",
					uei: "123456789012",
				},
				awarding_office: {
					agency_name: "Department of Defense",
					agency_code: "DOD",
					office_name: "Test Office",
				},
				naics_code: "541512",
				psc_code: "D302",
				set_aside: "8A",
				obligated: 1000000,
				total_contract_value: 5000000,
				period_of_performance: {
					start_date: "2024-01-01",
					last_date_to_order: "2029-12-31",
				},
			};

			const normalized = normalizeIDV(mockIDV);

			expect(normalized.idv_id).toBe("IDV_123");
			expect(normalized.piid).toBe("PIID123");
			expect(normalized.description).toBe("Test IDV");
			expect(normalized.vendor.name).toBe("Test Vendor");
			expect(normalized.vendor.uei).toBe("123456789012");
			expect(normalized.agency.name).toBe("Department of Defense");
			expect(normalized.agency.code).toBe("DOD");
			expect(normalized.award_amount).toBe(1000000);
			expect(normalized.total_contract_value).toBe(5000000);
			expect(normalized.naics_code).toBe("541512");
			expect(normalized.psc_code).toBe("D302");
			expect(normalized.set_aside).toBe("8A");
		});

		it("should handle missing optional fields gracefully", () => {
			const mockIDV: TangoIDVResponse = {
				key: "IDV_123",
			};

			const normalized = normalizeIDV(mockIDV);

			expect(normalized.idv_id).toBe("IDV_123");
			expect(normalized.piid).toBeNull();
			expect(normalized.description).toBeNull();
			expect(normalized.vendor.name).toBe("Unknown Vendor");
			expect(normalized.vendor.uei).toBeNull();
			expect(normalized.agency.name).toBeNull();
			expect(normalized.award_amount).toBe(0);
			expect(normalized.funding_office).toBeNull();
		});
	});

	describe("error handling", () => {
		it("should handle API errors gracefully", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: false,
				error: "API Error",
				status: 500,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			const result = await handler({
				query: "test",
				limit: 10,
			});

			expect(result.content[0].text).toContain("API Error");
			expect(result.content[0].text).toContain("API_ERROR");
		});

		it("should handle missing API key", async () => {
			const envWithoutKey: Env = {
				...mockEnv,
				TANGO_API_KEY: "",
			};

			registerSearchIDVsTool(mockServer, envWithoutKey);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			const result = await handler({
				query: "test",
				limit: 10,
			});

			expect(result.content[0].text).toContain("MISSING_API_KEY");
		});
	});

	describe("shape parameter", () => {
		it("should pass through shape parameter to API", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				awarding_agency: "GSA",
				limit: 5,
				shape: "key,piid,description,obligated",
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			expect(callParams.shape).toBe("key,piid,description,obligated");
		});

		it("should pass through wildcard shape syntax to API", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				awarding_agency: "GSA",
				limit: 5,
				shape: "key,recipient(*),obligated",
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			expect(callParams.shape).toBe("key,recipient(*),obligated");
		});

		it("should work without shape parameter (backward compatibility)", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				awarding_agency: "GSA",
				limit: 5,
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			expect(callParams.shape).toBeUndefined();
		});

		it("should include shape parameter in cache key when present", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			const mockCache = {
				get: vi.fn().mockResolvedValue(null),
				set: vi.fn().mockResolvedValue(undefined),
			} as any;

			registerSearchIDVsTool(mockServer, mockEnv, mockCache);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				awarding_agency: "GSA",
				limit: 5,
				shape: "key,piid,obligated",
			});

			// Verify cache.get was called with a key containing shape
			expect(mockCache.get).toHaveBeenCalled();
			const cacheKey = mockCache.get.mock.calls[0][0];
			expect(cacheKey).toContain("shape");
		});

		it("should differentiate cache keys with different shapes", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			const mockCache = {
				get: vi.fn().mockResolvedValue(null),
				set: vi.fn().mockResolvedValue(undefined),
			} as any;

			registerSearchIDVsTool(mockServer, mockEnv, mockCache);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			// Call with first shape
			await handler({
				awarding_agency: "GSA",
				limit: 5,
				shape: "key,piid",
			});

			const cacheKey1 = mockCache.get.mock.calls[0][0];

			// Call with different shape
			await handler({
				awarding_agency: "GSA",
				limit: 5,
				shape: "key,recipient(*)",
			});

			const cacheKey2 = mockCache.get.mock.calls[1][0];

			// Verify cache keys are different
			expect(cacheKey1).not.toBe(cacheKey2);
		});

		it("should pass empty shape parameter as-is", async () => {
			const { TangoApiClient } = await import("@/api/tango-client");
			const mockSearchIDVs = vi.fn().mockResolvedValue({
				success: true,
				data: { results: [], total: 0 },
				status: 200,
			});

			(TangoApiClient as any).mockImplementation(() => ({
				searchIDVs: mockSearchIDVs,
			}));

			registerSearchIDVsTool(mockServer, mockEnv);
			const handler = (mockServer.tool as any).mock.calls[0][3];

			await handler({
				awarding_agency: "GSA",
				limit: 5,
				shape: "",
			});

			const callParams = mockSearchIDVs.mock.calls[0][0];
			// Empty string should be passed through
			expect(callParams).toHaveProperty("shape");
			expect(callParams.shape).toBe("");
		});
	});
});
