/**
 * Search IDVs Tool
 *
 * Searches Indefinite Delivery Vehicles (IDVs) including GWACs, IDIQs, BPAs, and GSA Schedules.
 * These are master contract vehicles under which task orders are issued.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TangoApiClient } from "@/api/tango-client";
import type { CacheManager } from "@/cache/kv-cache";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import type { Env } from "@/types/env";
import { getLogger } from "@/utils/logger";
import { normalizeIDV } from "@/utils/normalizer";
import {
	extractCursorFromUrl,
	getOrderingDescription,
	validateIDVOrdering,
} from "@/utils/sort-helpers";
import { SET_ASIDE_CODES } from "@/data/set-aside-codes";
import { handleCsvExport } from "@/utils/csv-export";
import {
	toPipeDelimitedString,
	toUppercasePipeString,
	parseMultiValueParam,
} from "@/utils/array-helpers";

/**
 * Register search IDVs tool with the MCP server
 *
 * @param server MCP server instance
 * @param env Environment variables
 * @param cache Optional cache manager
 * @param userApiKey Optional user-specific API key (from x-tango-api-key header)
 */
export function registerSearchIDVsTool(
	server: McpServer,
	env: Env,
	cache?: CacheManager,
	userApiKey?: string,
): void {
	server.tool(
		"search_idvs",
		"Search Indefinite Delivery Vehicles (IDVs) including GWACs, IDIQs, BPAs, and GSA Schedules. These are master contract vehicles under which task orders are issued. Use this to find contract vehicles held by vendors, not individual task orders. Supports filtering by vendor (name/UEI), IDV type (GWAC/IDIQ/BPA/FSS/BOA), agencies, industry codes (NAICS/PSC), set-aside types, award dates, fiscal years, and expiration dates (last_date_to_order). Federal fiscal years: FY2024 = Oct 1, 2023 to Sep 30, 2024. Useful for finding active contract vehicles, identifying expiring vehicles, analyzing vendor portfolios, and market research.",
		{
			query: z
				.string()
				.optional()
				.describe(
					"Free-text search across IDV descriptions and titles. Best for: vendor names ('Booz Allen'), specific programs ('OASIS'), technologies ('cloud services'). Use awarding_agency parameter for agency-specific searches.",
				),
			recipient_uei: z
				.string()
				.optional()
				.describe(
					"Unique Entity Identifier (12-character alphanumeric). For exact vendor matching. Example: 'J3RW5C5KVLZ1'",
				),
			recipient_name: z
				.string()
				.optional()
				.describe(
					"Vendor/contractor name filter. Case-insensitive partial match. Example: 'Accenture Federal'",
				),
			idv_type: z
				.union([z.string(), z.array(z.string())])
				.optional()
				.describe(
					"IDV type code(s): A=GWAC, B=IDC/IDIQ, C=FSS/GSA Schedule, D=BOA, E=BPA. Single: 'A', Multiple: ['A','D'] or 'A|D'",
				),
			awarding_agency: z
				.string()
				.optional()
				.describe(
					"Awarding agency name or code. Example: 'GSA' or 'General Services Administration'",
				),
			funding_agency: z
				.string()
				.optional()
				.describe("Funding agency name or code (may differ from awarding)"),
			naics_code: z
				.union([z.string(), z.array(z.string())])
				.optional()
				.describe(
					"NAICS code(s). Single: '541512', Multiple: ['541512','541511'] or '541512|541511'. OR logic.",
				),
			psc_code: z
				.union([z.string(), z.array(z.string())])
				.optional()
				.describe("Product/Service Code(s). Example: 'D302' or ['D302','D307']"),
			set_aside_type: z
				.union([z.string(), z.array(z.string())])
				.optional()
				.describe(
					"Set-aside code(s): SBA, 8A, SDVOSB, WOSB, HUBZone, etc. Example: '8A' or ['8A','SDVOSB']",
				),
			award_date_start: z
				.string()
				.optional()
				.describe("Earliest award date (YYYY-MM-DD). Example: '2024-01-01'"),
			award_date_end: z
				.string()
				.optional()
				.describe("Latest award date (YYYY-MM-DD). Example: '2024-12-31'"),
			fiscal_year: z
				.number()
				.optional()
				.describe("Exact fiscal year (YYYY). Example: 2024"),
			fiscal_year_start: z
				.number()
				.optional()
				.describe("Earliest fiscal year to include (YYYY). Example: 2022"),
			fiscal_year_end: z
				.number()
				.optional()
				.describe("Latest fiscal year to include (YYYY). Example: 2024"),
			expiring_after: z
				.string()
				.optional()
				.describe(
					"Find IDVs with last_date_to_order after this date (YYYY-MM-DD). Useful for finding active vehicles.",
				),
			expiring_before: z
				.string()
				.optional()
				.describe(
					"Find IDVs with last_date_to_order before this date (YYYY-MM-DD). Useful for finding expiring vehicles.",
				),
			pop_start_date_after: z
				.string()
				.optional()
				.describe(
					"Earliest period of performance start date (YYYY-MM-DD)",
				),
			pop_start_date_before: z
				.string()
				.optional()
				.describe("Latest period of performance start date (YYYY-MM-DD)"),
			limit: z
				.number()
				.min(1)
				.max(100)
				.default(10)
				.describe("Number of results to return (1-100, default: 10)"),
			cursor: z
				.string()
				.optional()
				.describe(
					"Pagination cursor from previous response's next_cursor field",
				),
			ordering: z
				.string()
				.optional()
				.describe(
					"Sort field: award_date, obligated, recipient_name, fiscal_year, -award_date (desc)",
				),
			export_format: z
				.enum(["json", "csv"])
				.default("json")
				.describe(
					"Export format: json (default) or csv for spreadsheet import",
				),
		},
		async (args) => {
			const startTime = Date.now();
			const logger = getLogger();

			try {
				// Log tool invocation
				logger.toolInvocation("search_idvs", args, startTime);

				// Sanitize input
				const sanitized = sanitizeToolArgs(args);

				// Get API key: prefer user-specific key, fall back to environment variable
				const apiKey = userApiKey || env.TANGO_API_KEY;
				if (!apiKey) {
					logger.error("Missing API key", undefined, {
						tool: "search_idvs",
					});
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										error: "Tango API key required",
										error_code: "MISSING_API_KEY",
										suggestion:
											"Configure x-tango-api-key header in Claude Desktop config or set TANGO_API_KEY environment variable",
										documentation: "https://tango.makegov.com for API key",
										recoverable: true,
									},
									null,
									2,
								),
							},
						],
					};
				}

				// Build API parameters
				const params: Record<string, unknown> = {};

				// Free-text search
				if (sanitized.query) params.search = sanitized.query;

				// Recipient filtering - map to correct API parameters
				if (sanitized.recipient_name) params.recipient = sanitized.recipient_name;
				if (sanitized.recipient_uei) params.uei = sanitized.recipient_uei;

				// Agency filters
				if (sanitized.awarding_agency)
					params.awarding_agency = sanitized.awarding_agency;
				if (sanitized.funding_agency)
					params.funding_agency = sanitized.funding_agency;

				// IDV Type - array to pipe conversion with validation
				if (sanitized.idv_type) {
					const idvTypeValue = toUppercasePipeString(sanitized.idv_type);

					if (idvTypeValue) {
						// Validate codes (A-E)
						const codes = parseMultiValueParam(sanitized.idv_type);
						const validCodes = ["A", "B", "C", "D", "E"];
						if (codes) {
							const invalid = codes
								.map((c) => c.toUpperCase())
								.filter((c) => !validCodes.includes(c));
							if (invalid.length > 0) {
								logger.warn("Invalid IDV type codes", {
									invalid,
									valid: validCodes,
								});
							}
						}

						params.idv_type = idvTypeValue;
					}
				}

				// NAICS - array to pipe conversion (handles MCP JSON serialization)
				if (sanitized.naics_code) {
					const naicsValue = toPipeDelimitedString(sanitized.naics_code);
					if (naicsValue) {
						params.naics = naicsValue;
					}
				}

				// PSC - array to pipe conversion (handles MCP JSON serialization)
				if (sanitized.psc_code) {
					const pscValue = toPipeDelimitedString(sanitized.psc_code);
					if (pscValue) {
						params.psc = pscValue;
					}
				}

				// Set-aside - array to pipe conversion with validation
				if (sanitized.set_aside_type) {
					const setAsideValue = toUppercasePipeString(sanitized.set_aside_type);

					if (setAsideValue) {
						// Validate against lookup table (non-blocking)
						const codes = parseMultiValueParam(sanitized.set_aside_type);
						if (codes) {
							const unrecognized = codes
								.map((c) => c.toUpperCase())
								.filter((c) => !SET_ASIDE_CODES[c]);
							if (unrecognized.length > 0) {
								logger.info("Unrecognized set-aside codes", { unrecognized });
							}
						}

						params.set_aside = setAsideValue;
					}
				}

				// Date range filters
				if (sanitized.award_date_start)
					params.award_date_gte = sanitized.award_date_start;
				if (sanitized.award_date_end)
					params.award_date_lte = sanitized.award_date_end;
				if (sanitized.expiring_after)
					params.expiring_gte = sanitized.expiring_after;
				if (sanitized.expiring_before)
					params.expiring_lte = sanitized.expiring_before;
				if (sanitized.pop_start_date_after)
					params.pop_start_date_gte = sanitized.pop_start_date_after;
				if (sanitized.pop_start_date_before)
					params.pop_start_date_lte = sanitized.pop_start_date_before;

				// Fiscal year filters
				if (sanitized.fiscal_year) {
					params.fiscal_year_gte = sanitized.fiscal_year.toString();
					params.fiscal_year_lte = sanitized.fiscal_year.toString();
				} else {
					if (sanitized.fiscal_year_start)
						params.fiscal_year_gte = sanitized.fiscal_year_start.toString();
					if (sanitized.fiscal_year_end)
						params.fiscal_year_lte = sanitized.fiscal_year_end.toString();
				}

				// Pagination & sorting
				params.limit = sanitized.limit || 10;
				if (sanitized.cursor) params.cursor = sanitized.cursor;
				if (sanitized.ordering) {
					const validationResult = validateIDVOrdering(sanitized.ordering);
					if (validationResult.valid) {
						params.ordering = sanitized.ordering;
					} else {
						logger.warn("Invalid ordering field", {
							field: sanitized.ordering,
							suggestion: validationResult.suggestion,
						});
					}
				}
				if (sanitized.export_format) params.format = sanitized.export_format;

				// Call Tango API with caching
				logger.info("Calling Tango API", {
					endpoint: "searchIDVs",
					params,
				});
				const client = new TangoApiClient(env, cache);
				const response = await client.searchIDVs(params, apiKey);
				logger.apiCall(
					"/idvs",
					"GET",
					response.status || 200,
					Date.now() - startTime,
				);

				// Handle API error
				if (!response.success || !response.data) {
					logger.warn("API request failed", {
						error: response.error,
						status: response.status,
					});
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										error: response.error || "API request failed",
										error_code: "API_ERROR",
										status: response.status,
										suggestion: "Check your search parameters and try again",
										recoverable: true,
										transient:
											response.status === 429 || response.status === 503,
									},
									null,
									2,
								),
							},
						],
					};
				}

				// Handle CSV format response
				if (response.format === "csv") {
					const csvData = response.data as unknown as string;
					return handleCsvExport(csvData, "search_idvs", logger, startTime);
				}

				// Normalize results (JSON format)
				const normalizedIDVs = (response.data.results || []).map(normalizeIDV);

				// Extract cursor for next page
				const nextCursor = extractCursorFromUrl(response.data.next);

				// Build response envelope
				logger.toolComplete(
					"search_idvs",
					true,
					Date.now() - startTime,
					{
						returned: normalizedIDVs.length,
						total: response.data.total || response.data.count,
					},
				);

				const result = {
					data: normalizedIDVs,
					total:
						response.data.total ||
						response.data.count ||
						normalizedIDVs.length,
					returned: normalizedIDVs.length,
					filters: sanitized,
					pagination: {
						limit: sanitized.limit || 10,
						has_more:
							!!nextCursor ||
							(normalizedIDVs.length >= (sanitized.limit || 10) &&
								normalizedIDVs.length <
									(response.data.total || response.data.count || 0)),
						next_cursor: nextCursor,
						ordering: sanitized.ordering
							? getOrderingDescription(sanitized.ordering)
							: undefined,
					},
					execution: {
						duration_ms: Date.now() - startTime,
						cached: response.cache?.hit || false,
						api_calls: 1,
					},
				};

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			} catch (error) {
				// Handle unexpected errors
				logger.error(
					"Unexpected error in search_tango_idvs",
					error instanceof Error ? error : new Error(String(error)),
					{ tool: "search_idvs" },
				);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									error:
										error instanceof Error ? error.message : "Unknown error",
									error_code: "INTERNAL_ERROR",
									suggestion: "Contact support if this error persists",
									recoverable: false,
									execution: {
										duration_ms: Date.now() - startTime,
									},
								},
								null,
								2,
							),
						},
					],
				};
			}
		},
	);
}
