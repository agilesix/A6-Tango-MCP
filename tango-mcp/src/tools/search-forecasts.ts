/**
 * Search Forecasts Tool
 *
 * Searches federal procurement forecast opportunities from multiple government agencies.
 * Provides access to anticipated future contracting opportunities with expected award dates.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TangoApiClient } from "@/api/tango-client";
import type { CacheManager } from "@/cache/kv-cache";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import type { Env } from "@/types/env";
import { getLogger } from "@/utils/logger";
import { normalizeForecast } from "@/utils/normalizer";
import { extractCursorFromUrl } from "@/utils/sort-helpers";
import { handleCsvExport } from "@/utils/csv-export";
import { toPipeDelimitedString } from "@/utils/array-helpers";
import { analyzeQuery } from "@/utils/query-analyzer";

/**
 * Register search forecasts tool with the MCP server
 */
export function registerSearchForecastsTool(
	server: McpServer,
	env: Env,
	cache?: CacheManager,
	userApiKey?: string,
): void {
	server.tool(
		"search_forecasts",
		"Search federal procurement forecast opportunities from government agencies that publish forecasts. Forecasts represent anticipated future procurement opportunities with expected award dates and planning information. Returns forecast details including title, description, agency, source system, anticipated award date, fiscal year, NAICS code, status, set-aside type, primary contact, place of performance, and contract period estimates. SEARCH BEHAVIOR: The 'query' parameter performs AND-logic phrase matching - ALL words in your query must appear in results. Multi-word queries like 'artificial intelligence AI machine learning' often return zero results. BEST PRACTICES: Use 1-2 specific keywords ('cybersecurity', 'cloud services'), separate agency from topic using the agency parameter, try single terms first ('AI' before 'artificial intelligence AI'). EXAMPLES THAT WORK: query='cybersecurity' with agency='HHS', query='professional services', query='AI'. EXAMPLES THAT DON'T WORK: query='HHS cloud AI services' (mixing agency + topics), query='artificial intelligence AI ML' (too many synonyms). Supports filtering by: free-text search, agency, source system, NAICS code (exact or prefix), fiscal year (exact or range), status, award date range, modification date range, and active status. IMPORTANT: Not all agencies publish forecasts to Tango (e.g., VA does not). Common agencies with forecasts: HHS, DHS, GSA, NIH, FAA, NIST. Useful for procurement planning, market intelligence, and identifying upcoming opportunities. Maximum 100 results per request. Supports CSV export via export_format parameter.",
		{
			query: z
				.string()
				.optional()
				.describe(
					"Free-text search across forecast titles and descriptions. API uses AND logic - ALL words must match. Effective queries: Single concepts like 'cybersecurity', 'cloud infrastructure', or 'IT modernization'. Ineffective queries: Multiple synonyms ('AI artificial intelligence ML'), mixing agency + topic ('VA cybersecurity'). TIP: Start simple. Try 'AI' before 'artificial intelligence AI machine learning'. Use other parameters (agency, naics_code) for structured filtering instead of mixing them into the query string. Examples: 'cloud infrastructure', 'professional services', 'medical equipment'",
				),
			agency: z
				.string()
				.optional()
				.describe(
					"Agency acronym (e.g., 'HHS', 'DHS', 'GSA'). Supports OR logic with pipe (HHS|DHS) or AND logic with comma (HHS,DHS). Example: 'HHS' or 'DHS|GSA'. Note: Not all agencies publish forecasts.",
				),
			source_system: z
				.string()
				.optional()
				.describe(
					"Source agency system. Supports OR logic with pipe (HHS|DHS|GSA). Example: 'HHS' or 'DHS|GSA'",
				),
			naics_code: z
				.union([z.string(), z.array(z.string())])
				.optional()
				.describe(
					"NAICS industry classification code(s). Single code: '541512', Multiple codes: ['541512', '541511'] or pipe-separated '541512|541511'. Searches forecasts matching ANY of the provided codes (OR logic). Must be exact 6-digit codes.",
				),
			naics_starts_with: z
				.string()
				.optional()
				.describe(
					"Filter by NAICS code prefix for broader industry search. Example: '54' for Professional Services, '541' for Professional/Scientific/Technical Services. Supports OR logic with pipe (54|62) or AND logic with comma (54,62).",
				),
			fiscal_year: z
				.number()
				.int()
				.optional()
				.describe(
					"Exact fiscal year filter. Example: 2025",
				),
			fiscal_year_gte: z
				.number()
				.int()
				.optional()
				.describe(
					"Fiscal year greater than or equal to. Example: 2024 for FY2024 and later",
				),
			fiscal_year_lte: z
				.number()
				.int()
				.optional()
				.describe(
					"Fiscal year less than or equal to. Example: 2026 for FY2026 and earlier",
				),
			status: z
				.string()
				.optional()
				.describe(
					"Forecast status. Supports OR logic with pipe. Common values: 'PUBLISHED', 'DRAFT'. Example: 'PUBLISHED|DRAFT'",
				),
			award_date_after: z
				.string()
				.optional()
				.describe(
					"Anticipated award date on or after (YYYY-MM-DD format). Example: '2025-01-01'",
				),
			award_date_before: z
				.string()
				.optional()
				.describe(
					"Anticipated award date on or before (YYYY-MM-DD format). Example: '2025-12-31'",
				),
			modified_after: z
				.string()
				.optional()
				.describe(
					"Last modified in Tango on or after (YYYY-MM-DD format). Useful for finding recently updated forecasts. Example: '2025-01-01'",
				),
			modified_before: z
				.string()
				.optional()
				.describe(
					"Last modified in Tango on or before (YYYY-MM-DD format). Example: '2025-12-31'",
				),
			active: z
				.boolean()
				.optional()
				.describe(
					"Filter by active status. true = active forecasts only, false = inactive, undefined = all",
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
					"Export format for search results. 'json' returns structured JSON data (default). 'csv' returns comma-separated values suitable for Excel/spreadsheets.",
				),
			ordering: z
				.string()
				.optional()
				.describe(
					"Field to sort results by. Prefix with '-' for descending order. Valid fields: 'anticipated_award_date', '-anticipated_award_date', 'fiscal_year', '-fiscal_year'. Example: '-anticipated_award_date' for soonest awards first.",
				),
			cursor: z
				.string()
				.optional()
				.describe(
					"Pagination cursor for fetching next page. Obtained from previous response's next_cursor field.",
				),
		},
		async (args) => {
			const startTime = Date.now();
			const logger = getLogger();

			try {
				logger.toolInvocation("search_forecasts", args, startTime);

				// Sanitize input
				const sanitized = sanitizeToolArgs(args);

				// Get API key from user or environment
				const apiKey = userApiKey || env.TANGO_API_KEY;
				if (!apiKey) {
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
				if (sanitized.agency) params.agency = sanitized.agency;
				if (sanitized.source_system) params.source_system = sanitized.source_system;

				// Handle NAICS code (handles MCP JSON serialization)
				if (sanitized.naics_code) {
					const naicsValue = toPipeDelimitedString(sanitized.naics_code);
					if (naicsValue) {
						params.naics_code = naicsValue;
					}
				}

				if (sanitized.naics_starts_with) params.naics_starts_with = sanitized.naics_starts_with;
				if (sanitized.fiscal_year !== undefined) params.fiscal_year = sanitized.fiscal_year;
				if (sanitized.fiscal_year_gte !== undefined) params.fiscal_year_gte = sanitized.fiscal_year_gte;
				if (sanitized.fiscal_year_lte !== undefined) params.fiscal_year_lte = sanitized.fiscal_year_lte;
				if (sanitized.status) params.status = sanitized.status;
				if (sanitized.award_date_after) params.award_date_after = sanitized.award_date_after;
				if (sanitized.award_date_before) params.award_date_before = sanitized.award_date_before;
				if (sanitized.modified_after) params.modified_after = sanitized.modified_after;
				if (sanitized.modified_before) params.modified_before = sanitized.modified_before;
				if (sanitized.active !== undefined) params.active = sanitized.active;
				if (sanitized.ordering) params.ordering = sanitized.ordering;
				if (sanitized.cursor) params.cursor = sanitized.cursor;

				params.limit = sanitized.limit || 10;

				// Add format parameter for CSV export if requested
				if (sanitized.export_format) {
					params.format = sanitized.export_format;
				}

				// Call Tango API with caching
				const client = new TangoApiClient(env, cache);
				const response = await client.searchForecasts(params, apiKey);

				// Handle API error
				if (!response.success || !response.data) {
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
					return handleCsvExport(csvData, "search_forecasts", logger, startTime);
				}

				// Normalize results (JSON format)
				const normalizedForecasts = (response.data.results || []).map(
					normalizeForecast,
				);

				// Check for zero results with query and provide enhanced guidance
				if (normalizedForecasts.length === 0 && sanitized.query) {
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
													agency: analysis.suggestedAgency,
													query: analysis.refinedQuery || sanitized.query,
												},
												explanation: `Your query "${sanitized.query}" appears to mix agency and topic keywords. The API uses AND logic (all words must match) and works best when agency filters are separated from free-text search. Try using agency="${analysis.suggestedAgency}" with query="${analysis.refinedQuery || sanitized.query}". Note: Not all agencies publish forecasts to Tango. If this agency has no forecasts, you'll get zero results even with the correct parameters.`,
												example: {
													tool: "search_forecasts",
													params: {
														agency: analysis.suggestedAgency,
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
					"search_forecasts",
					true,
					Date.now() - startTime,
					{
						returned: normalizedForecasts.length,
						total: response.data.total || response.data.count,
					},
				);

				const result = {
					data: normalizedForecasts,
					total:
						response.data.total ||
						response.data.count ||
						normalizedForecasts.length,
					returned: normalizedForecasts.length,
					filters: sanitized,
					pagination: {
						limit: sanitized.limit || 10,
						has_more:
							!!nextCursor ||
							(normalizedForecasts.length >= (sanitized.limit || 10) &&
								normalizedForecasts.length <
									(response.data.total || response.data.count || 0)),
						next_cursor: nextCursor,
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
					"Unexpected error in search_tango_forecasts",
					error instanceof Error ? error : new Error(String(error)),
					{ tool: "search_forecasts" }
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
