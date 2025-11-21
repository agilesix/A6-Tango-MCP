/**
 * Search Contracts Tool
 *
 * Searches federal contract awards from FPDS through Tango API.
 * Supports filtering by vendor, agency, industry codes, dates, and set-aside types.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TangoApiClient } from "@/api/tango-client";
import type { CacheManager } from "@/cache/kv-cache";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import type { Env } from "@/types/env";
import { getLogger } from "@/utils/logger";
import { normalizeContract } from "@/utils/normalizer";
import { analyzeQuery } from "@/utils/query-analyzer";
import {
	extractCursorFromUrl,
	getOrderingDescription,
	validateContractOrdering,
} from "@/utils/sort-helpers";
import { SET_ASIDE_CODES } from "@/data/set-aside-codes";
import { handleCsvExport } from "@/utils/csv-export";
import {
	toPipeDelimitedString,
	toUppercasePipeString,
	parseMultiValueParam,
} from "@/utils/array-helpers";

/**
 * Register search contracts tool with the MCP server
 *
 * @param server MCP server instance
 * @param env Environment variables
 * @param cache Optional cache manager
 * @param userApiKey Optional user-specific API key (from x-tango-api-key header)
 */
export function registerSearchContractsTool(
	server: McpServer,
	env: Env,
	cache?: CacheManager,
	userApiKey?: string,
): void {
	server.tool(
		"search_contracts",
		"Search federal contract awards from FPDS (Federal Procurement Data System) through Tango's unified API. Returns contract details including vendor information (name, UEI, DUNS), agency details, award amounts, NAICS/PSC codes, set-aside types, and performance location. Supports filtering by: free-text search, vendor name/UEI, awarding agency, funding agency (may differ from awarding), industry classifications (NAICS/PSC), award date ranges, period of performance dates (PoP start/end), contract expiration dates, fiscal year (FY runs Oct-Sep), and set-aside categories. Federal fiscal years: FY2024 = Oct 1, 2023 to Sep 30, 2024. Useful for finding contracts by vendor, agency spending analysis, market research, competitor analysis, and identifying expiring contracts. Maximum 100 results per request. Supports CSV export via export_format parameter for Excel/spreadsheet integration, and cursor-based pagination for large result sets.",
		{
			query: z
				.string()
				.optional()
				.describe(
					"Free-text search across contract descriptions and titles. BEST PRACTICES: Use for single concepts like vendor names ('Lockheed Martin'), specific technologies ('cloud computing'), or services ('IT modernization'). AVOID mixing multiple concepts in one query. EXAMPLES OF WHAT WORKS WELL: query='cybersecurity' with awarding_agency='VA', query='Agile Six' (vendor search), query='data analytics platform'. EXAMPLES OF WHAT DOESN'T WORK: query='VA digital services' (mixing agency + topic - returns 0 results). INSTEAD USE: awarding_agency='Department of Veterans Affairs' with query='digital services'. For agency searches, always use the 'awarding_agency' parameter. For industry classifications, use 'naics_code' or 'psc_code' parameters. The API performs best when agency filters are separated from free-text search terms.",
				),
			vendor_name: z
				.string()
				.optional()
				.describe(
					"Vendor/contractor name filter. Case-insensitive partial match. Example: 'Lockheed Martin'",
				),
			vendor_uei: z
				.string()
				.optional()
				.describe(
					"Unique Entity Identifier (12-character alphanumeric). For exact vendor matching. Example: 'J3RW5C5KVLZ1'",
				),
			awarding_agency: z
				.string()
				.optional()
				.describe(
					"Awarding agency name or code. Example: 'Department of Defense' or 'DOD'",
				),
			funding_agency: z
				.string()
				.optional()
				.describe(
					"Funding agency name or code (may differ from awarding agency). Example: 'Department of Defense' or 'DOD'",
				),
			naics_code: z
				.union([z.string(), z.array(z.string())])
				.optional()
				.describe(
					"NAICS industry classification code(s). Single code: '541512', Multiple codes: ['541512', '541511', '541519'] or pipe-separated '541512|541511|541519'. Searches contracts matching ANY of the provided codes (OR logic). Supports 2-6 digit codes.",
				),
			psc_code: z
				.string()
				.optional()
				.describe("Product/Service Code. Example: 'D302' for IT and telecom"),
			award_date_start: z
				.string()
				.optional()
				.describe(
					"Earliest award date to include (YYYY-MM-DD format). Example: '2024-01-01'",
				),
			award_date_end: z
				.string()
				.optional()
				.describe(
					"Latest award date to include (YYYY-MM-DD format). Example: '2024-12-31'",
				),
			pop_start_date_after: z
				.string()
				.optional()
				.describe(
					"Earliest period of performance start date to include (YYYY-MM-DD format). Example: '2024-01-01'",
				),
			pop_start_date_before: z
				.string()
				.optional()
				.describe(
					"Latest period of performance start date to include (YYYY-MM-DD format). Example: '2024-12-31'",
				),
			pop_end_date_after: z
				.string()
				.optional()
				.describe(
					"Earliest period of performance end date to include (YYYY-MM-DD format). Example: '2024-01-01'",
				),
			pop_end_date_before: z
				.string()
				.optional()
				.describe(
					"Latest period of performance end date to include (YYYY-MM-DD format). Example: '2024-12-31'",
				),
			expiration_date_after: z
				.string()
				.optional()
				.describe(
					"Filter contracts expiring on or after this date, based on ultimate period of performance end date (YYYY-MM-DD format). Example: '2024-01-01'",
				),
			expiration_date_before: z
				.string()
				.optional()
				.describe(
					"Filter contracts expiring on or before this date, based on ultimate period of performance end date (YYYY-MM-DD format). Example: '2024-12-31'",
				),
			set_aside_type: z
				.string()
				.optional()
				.describe(
					"Contract set-aside category. Common values: 'SBA' (Small Business), 'WOSB' (Women-Owned), 'SDVOSB' (Service-Disabled Veteran), '8A' (8(a) Program), 'HZC' (HUBZone), 'VOSB' (Veteran-Owned), 'NONE' (Full & Open). Use | for multiple: 'SDVOSB|VOSB'. See documentation for complete list of ~20 codes.",
				),
			fiscal_year: z
				.number()
				.int()
				.min(1990)
				.max(2030)
				.optional()
				.describe(
					"Filter by exact federal fiscal year. Format: YYYY. Example: 2024 for FY2024 (Oct 2023 - Sep 2024). Mutually exclusive with fiscal_year_start/end.",
				),
			fiscal_year_start: z
				.number()
				.int()
				.min(1990)
				.max(2030)
				.optional()
				.describe(
					"Filter by fiscal year range start (inclusive). Example: 2020 for FY2020 and later. Use with fiscal_year_end for ranges.",
				),
			fiscal_year_end: z
				.number()
				.int()
				.min(1990)
				.max(2030)
				.optional()
				.describe(
					"Filter by fiscal year range end (inclusive). Example: 2024 for FY2024 and earlier. Use with fiscal_year_start for ranges.",
				),
			limit: z
				.number()
				.int()
				.min(1)
				.max(100)
				.default(10)
				.optional()
				.describe(
					"Maximum results to return. Default: 10, Maximum: 100. Use smaller values for faster responses.",
				),
			export_format: z
				.enum(["json", "csv"])
				.default("json")
				.optional()
				.describe(
					"Export format for search results. 'json' returns structured JSON data (default). 'csv' returns comma-separated values suitable for Excel/spreadsheets. Note: CSV format returns raw CSV string from API.",
				),
			ordering: z
				.string()
				.optional()
				.describe(
					"Field to sort results by. Prefix with '-' for descending order. Valid fields: 'award_date', '-award_date', 'obligated', '-obligated', 'recipient_name', '-recipient_name'. Example: '-award_date' for newest first, '-obligated' for highest value first.",
				),
			cursor: z
				.string()
				.optional()
				.describe(
					"Pagination cursor for fetching next page. Obtained from previous response's next_cursor field. More efficient than offset-based pagination for large datasets.",
				),
			shape: z
				.string()
				.optional()
				.describe(
					"Reduce payload size 60-85%. Format: comma-separated field names. " +
					"Basic: 'key,piid,description,obligated' | " +
					"Nested: 'key,recipient(*),awarding_office(*),obligated' | " +
					"Scalar fields: key,piid,description,award_date,fiscal_year,obligated,total_contract_value,naics_code,psc_code,set_aside | " +
					"Nested fields: recipient(*),awarding_office(*),funding_office(*),period_of_performance(*),place_of_performance(*)"
				),
		},
		async (args) => {
			const startTime = Date.now();
			const logger = getLogger();

			try {
				// Log tool invocation
				logger.toolInvocation("search_contracts", args, startTime);

				// Sanitize input
				const sanitized = sanitizeToolArgs(args);

				// Get API key: prefer user-specific key, fall back to environment variable
				const apiKey = userApiKey || env.TANGO_API_KEY;
				if (!apiKey) {
					logger.error("Missing API key", undefined, {
						tool: "search_contracts",
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
				if (sanitized.query) params.search = sanitized.query;
				if (sanitized.vendor_name) params.recipient = sanitized.vendor_name;
				if (sanitized.vendor_uei) params.uei = sanitized.vendor_uei;
				if (sanitized.awarding_agency)
					params.awarding_agency = sanitized.awarding_agency;
				if (sanitized.funding_agency)
					params.funding_agency = sanitized.funding_agency;
				if (sanitized.naics_code) {
					// Support multiple NAICS codes (handles MCP JSON serialization)
					const naicsValue = toPipeDelimitedString(sanitized.naics_code);
					if (naicsValue) {
						params.naics = naicsValue;
					}
				}
				if (sanitized.psc_code) params.psc = sanitized.psc_code;
				if (sanitized.award_date_start)
					params.award_date_gte = sanitized.award_date_start;
				if (sanitized.award_date_end)
					params.award_date_lte = sanitized.award_date_end;
				if (sanitized.pop_start_date_after)
					params.pop_start_date_gte = sanitized.pop_start_date_after;
				if (sanitized.pop_start_date_before)
					params.pop_start_date_lte = sanitized.pop_start_date_before;
				if (sanitized.pop_end_date_after)
					params.pop_end_date_gte = sanitized.pop_end_date_after;
				if (sanitized.pop_end_date_before)
					params.pop_end_date_lte = sanitized.pop_end_date_before;
				if (sanitized.expiration_date_after)
					params.expiring_gte = sanitized.expiration_date_after;
				if (sanitized.expiration_date_before)
					params.expiring_lte = sanitized.expiration_date_before;
				if (sanitized.set_aside_type) {
					// Support multiple set-aside codes (handles MCP JSON serialization)
					const setAsideValue = toUppercasePipeString(sanitized.set_aside_type);

					if (setAsideValue) {
						// Validate codes against lookup table (informational only, don't block)
						const codes = parseMultiValueParam(sanitized.set_aside_type);
						if (codes) {
							const unrecognized = codes
								.map((c) => c.toUpperCase())
								.filter((c) => !SET_ASIDE_CODES[c]);
							if (unrecognized.length > 0) {
								logger.info("Unrecognized set-aside codes in query", {
									input: sanitized.set_aside_type,
									unrecognized,
									validCodes: `${Object.keys(SET_ASIDE_CODES).slice(0, 10).join(", ")}...`,
								});
							}
						}

						params.set_aside = setAsideValue;
					}
				}

				// Fiscal year parameters (map to API's fiscal_year_gte/lte)
				if (sanitized.fiscal_year) {
					// Exact year: set both gte and lte to same year
					params.fiscal_year_gte = sanitized.fiscal_year.toString();
					params.fiscal_year_lte = sanitized.fiscal_year.toString();

					// Validation: fiscal_year mutually exclusive with start/end
					if (sanitized.fiscal_year_start || sanitized.fiscal_year_end) {
						return {
							content: [
								{
									type: "text",
									text: JSON.stringify(
										{
											error: "Parameter conflict",
											error_code: "INVALID_PARAMETER_COMBINATION",
											message:
												"Use either fiscal_year OR fiscal_year_start/end, not both",
											parameters_provided: {
												fiscal_year: sanitized.fiscal_year,
												fiscal_year_start: sanitized.fiscal_year_start,
												fiscal_year_end: sanitized.fiscal_year_end,
											},
											suggestion:
												"Remove fiscal_year to use range, or remove fiscal_year_start/end to use exact year",
											recoverable: true,
										},
										null,
										2,
									),
								},
							],
						};
					}
				} else {
					// Range: use start/end
					if (sanitized.fiscal_year_start) {
						params.fiscal_year_gte = sanitized.fiscal_year_start.toString();
					}
					if (sanitized.fiscal_year_end) {
						params.fiscal_year_lte = sanitized.fiscal_year_end.toString();
					}

					// Validation: start <= end
					if (
						sanitized.fiscal_year_start &&
						sanitized.fiscal_year_end &&
						sanitized.fiscal_year_start > sanitized.fiscal_year_end
					) {
						return {
							content: [
								{
									type: "text",
									text: JSON.stringify(
										{
											error: "Invalid fiscal year range",
											error_code: "INVALID_PARAMETER_VALUE",
											message: "fiscal_year_start must be <= fiscal_year_end",
											provided: {
												fiscal_year_start: sanitized.fiscal_year_start,
												fiscal_year_end: sanitized.fiscal_year_end,
											},
											suggestion: "Swap the values or correct the range",
											recoverable: true,
										},
										null,
										2,
									),
								},
							],
						};
					}
				}

				params.limit = sanitized.limit || 10;

				// Add format parameter for CSV export if requested
				if (sanitized.export_format) {
					params.format = sanitized.export_format;
				}

				// Add ordering parameter if provided
				if (sanitized.ordering) {
					// Validate ordering parameter
					if (!validateContractOrdering(sanitized.ordering)) {
						return {
							content: [
								{
									type: "text",
									text: JSON.stringify(
										{
											error: "Invalid ordering parameter",
											error_code: "INVALID_PARAMETER_VALUE",
											message: `Invalid ordering field: ${sanitized.ordering}`,
											valid_fields: [
												"award_date",
												"-award_date",
												"obligated",
												"-obligated",
												"recipient_name",
												"-recipient_name",
											],
											suggestion:
												"Use one of the valid ordering fields listed above",
											recoverable: true,
										},
										null,
										2,
									),
								},
							],
						};
					}
					params.ordering = sanitized.ordering;
				}

				// Add cursor parameter if provided
				if (sanitized.cursor) {
					params.cursor = sanitized.cursor;
				}

				// Add shape parameter if provided
				if (sanitized.shape) {
					params.shape = sanitized.shape;
				}

				// Call Tango API with caching
				logger.info("Calling Tango API", {
					endpoint: "searchContracts",
					params,
				});
				const client = new TangoApiClient(env, cache);
				const response = await client.searchContracts(params, apiKey);
				logger.apiCall(
					"/contracts",
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
					return handleCsvExport(csvData, "search_contracts", logger, startTime);
				}

				// Normalize results (JSON format)
				const normalizedContracts = (response.data.results || []).map(
					normalizeContract,
				);

				// Check for zero results with query and provide enhanced guidance
				if (normalizedContracts.length === 0 && sanitized.query) {
					const analysis = analyzeQuery(sanitized.query);

					// If high confidence agency detection, provide enhanced response with suggestions
					if (analysis.confidence === "high" && analysis.suggestedAgency) {
						logger.info("Zero results with detected agency pattern", {
							query: sanitized.query,
							detectedAgency: analysis.suggestedAgency,
							confidence: analysis.confidence,
						});

						return {
							content: [
								{
									type: "text",
									text: JSON.stringify(
										{
											data: [],
											total: 0,
											returned: 0,
											filters: sanitized,
											suggestions: {
												detected_issue: "Zero results for multi-concept query",
												recommended_approach: {
													awarding_agency: analysis.suggestedAgency,
													query: analysis.refinedQuery || sanitized.query,
												},
												explanation: `Your query "${sanitized.query}" appears to mix agency and topic keywords. The API works best when agency filters are separated from free-text search. Try using awarding_agency="${analysis.suggestedAgency}" with query="${analysis.refinedQuery || sanitized.query}".`,
												example: {
													tool: "search_contracts",
													params: {
														awarding_agency: analysis.suggestedAgency,
														query: analysis.refinedQuery || undefined,
														limit: sanitized.limit,
													},
												},
											},
											execution: {
												duration_ms: Date.now() - startTime,
												cached: response.cache?.hit || false,
												api_calls: 1,
											},
										},
										null,
										2,
									),
								},
							],
						};
					}
				}

				// Extract cursor for next page
				const nextCursor = extractCursorFromUrl(response.data.next);

				// Build response envelope
				logger.toolComplete(
					"search_contracts",
					true,
					Date.now() - startTime,
					{
						returned: normalizedContracts.length,
						total: response.data.total || response.data.count,
					},
				);

				const result = {
					data: normalizedContracts,
					total:
						response.data.total ||
						response.data.count ||
						normalizedContracts.length,
					returned: normalizedContracts.length,
					filters: sanitized,
					pagination: {
						limit: sanitized.limit || 10,
						has_more:
							!!nextCursor ||
							(normalizedContracts.length >= (sanitized.limit || 10) &&
								normalizedContracts.length <
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
					"Unexpected error in search_tango_contracts",
					error instanceof Error ? error : new Error(String(error)),
					{ tool: "search_contracts" },
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
