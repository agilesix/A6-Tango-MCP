/**
 * Search Grants Tool
 *
 * Searches grant opportunities from Grants.gov through Tango API.
 * These are pre-award opportunities available for application, NOT post-award USASpending data.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SearchGrantsArgs } from "@/types/tool-args";
import type { Env } from "@/types/env";
import { TangoApiClient } from "@/api/tango-client";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import { normalizeGrantOpportunity } from "@/utils/normalizer";
import type { CacheManager } from "@/cache/kv-cache";
import { getLogger } from "@/utils/logger";
import { validateGrantOrdering, extractCursorFromUrl, getOrderingDescription } from "@/utils/sort-helpers";
import { z } from "zod";

/**
 * Register search grants tool with the MCP server
 */
export function registerSearchGrantsTool(
	server: McpServer,
	env: Env,
	cache?: CacheManager,
	userApiKey?: string
): void {
	server.tool(
		"search_tango_grants",
		"Search grant opportunities from Grants.gov through Tango's unified API. Returns pre-award opportunities available for application, NOT post-award USASpending data. Includes opportunity details: title, description, status (Posted/Forecasted), important dates (posted, response deadline), eligible applicant types, funding categories and instruments, funding details (ceiling, floor, estimated total), CFDA numbers, agency, contact information. Useful for: finding grant opportunities by subject area, identifying deadlines, checking eligibility requirements, researching funding amounts. Maximum 100 results per request.",
		{
			query: z
				.string()
				.optional()
				.describe(
					"Free-text search across opportunity titles and descriptions. Example: 'education', 'research', 'community development'"
				),
			agency: z
				.string()
				.optional()
				.describe(
					"Awarding agency abbreviation. Example: 'ED' (Education), 'NSF' (National Science Foundation), 'HHS' (Health and Human Services)"
				),
			naics_code: z
				.string()
				.optional()
				.describe(
					"NAICS industry classification code (2-6 digits). Example: '541512' (Computer systems design), '611' (Educational services)"
				),
			psc_code: z
				.string()
				.optional()
				.describe(
					"Product/Service Code. Example: 'R425' (Support - professional: engineering/technical)"
				),
			awarding_agency: z
				.string()
				.optional()
				.describe(
					"Awarding agency name or code. Example: 'Department of Education', 'ED'"
				),
			cfda_number: z
				.string()
				.optional()
				.describe(
					"Catalog of Federal Domestic Assistance number. Example: '84.027' (Special Education Grants), '93.778' (Medicaid)"
				),
			posted_date_after: z
				.string()
				.optional()
				.describe(
					"Earliest posted date to include (YYYY-MM-DD format). Example: '2024-01-01'"
				),
			posted_date_before: z
				.string()
				.optional()
				.describe(
					"Latest posted date to include (YYYY-MM-DD format). Example: '2024-12-31'"
				),
			response_date_after: z
				.string()
				.optional()
				.describe(
					"Earliest response deadline to include (YYYY-MM-DD format). Only opportunities with deadlines on or after this date. Example: '2024-12-01'"
				),
			response_date_before: z
				.string()
				.optional()
				.describe(
					"Latest response deadline to include (YYYY-MM-DD format). Example: '2024-12-31'"
				),
			applicant_types: z
				.string()
				.optional()
				.describe(
					"Filter by eligible applicant types. Comma-separated codes: 'SG' (State governments), 'LG' (Local governments), 'IHE' (Higher education), 'NP' (Nonprofits), 'PR' (Private), 'IND' (Individuals). Example: 'SG,LG' for state and local governments"
				),
			funding_categories: z
				.string()
				.optional()
				.describe(
					"Filter by funding activity categories. Comma-separated codes: 'ED' (Education), 'HL' (Health), 'ENV' (Environment), 'CD' (Community Development). Example: 'ED' or 'HL,ED'"
				),
			funding_instruments: z
				.string()
				.optional()
				.describe(
					"Filter by funding instrument types. Comma-separated codes: 'G' (Grant), 'CA' (Cooperative Agreement), 'PC' (Procurement Contract), 'O' (Other). Example: 'G' for grants only, 'G,CA' for grants and cooperative agreements"
				),
			status: z
				.string()
				.optional()
				.describe(
					"Filter by opportunity status. Values: 'P' (Posted - active, accepting applications), 'F' (Forecasted - upcoming opportunities). Example: 'P' for posted only"
				),
			ordering: z
				.string()
				.optional()
				.describe(
					"Field to sort results by. Prefix with '-' for descending order. Valid fields: 'posted_date', '-posted_date', 'response_date', '-response_date', 'award_amount', '-award_amount'. Example: '-response_date' for nearest deadline first."
				),
			limit: z
				.number()
				.int()
				.min(1)
				.max(100)
				.default(10)
				.optional()
				.describe(
					"Maximum results to return. Default: 10, Maximum: 100. Use smaller values for faster responses."
				),
			cursor: z
				.string()
				.optional()
				.describe(
					"Pagination cursor for fetching next page. Obtained from previous response's next_cursor field. More efficient than offset-based pagination for large datasets."
				),
		},
		async (args) => {
			const startTime = Date.now();
			const logger = getLogger();

			try {
				logger.toolInvocation("search_tango_grants", args, startTime);

				// Sanitize input
				const sanitized = sanitizeToolArgs(args);

				// Get API key from user or environment
				const apiKey = userApiKey || env.TANGO_API_KEY;
				if (!apiKey) {
					logger.error("Missing API key", undefined, { tool: "search_tango_grants" });
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
									2
								),
							},
						],
					};
				}

				// Build API parameters
				const params: Record<string, unknown> = {};
				if (sanitized.query) params.search = sanitized.query;
				if (sanitized.agency) params.agency = sanitized.agency;
				if (sanitized.naics_code) params.naics_code = sanitized.naics_code;
				if (sanitized.psc_code) params.psc_code = sanitized.psc_code;
				if (sanitized.awarding_agency) params.awarding_agency = sanitized.awarding_agency;
				if (sanitized.cfda_number) params.cfda_number = sanitized.cfda_number;
				if (sanitized.posted_date_after)
					params.posted_date_after = sanitized.posted_date_after;
				if (sanitized.posted_date_before)
					params.posted_date_before = sanitized.posted_date_before;
				if (sanitized.response_date_after)
					params.response_date_after = sanitized.response_date_after;
				if (sanitized.response_date_before)
					params.response_date_before = sanitized.response_date_before;
				if (sanitized.applicant_types)
					params.applicant_types = sanitized.applicant_types;
				if (sanitized.funding_categories)
					params.funding_categories = sanitized.funding_categories;
				if (sanitized.funding_instruments)
					params.funding_instruments = sanitized.funding_instruments;
				if (sanitized.status) params.status = sanitized.status;

				// Add ordering parameter if provided
				if (sanitized.ordering) {
					// Validate ordering parameter
					if (!validateGrantOrdering(sanitized.ordering)) {
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
												"posted_date",
												"-posted_date",
												"response_date",
												"-response_date",
												"award_amount",
												"-award_amount",
											],
											suggestion: "Use one of the valid ordering fields listed above",
											recoverable: true,
										},
										null,
										2
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

				params.limit = sanitized.limit || 10;

				// Call Tango API with caching
				logger.info("Calling Tango API", { endpoint: "searchGrants", params });
				const client = new TangoApiClient(env, cache);
				const response = await client.searchGrants(params, apiKey);
				logger.apiCall("/grants", "GET", response.status || 200, Date.now() - startTime);

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
										transient: response.status === 429 || response.status === 503,
									},
									null,
									2
								),
							},
						],
					};
				}

				// Normalize results
				const normalizedOpportunities = (response.data.results || []).map(
					normalizeGrantOpportunity
				);

				// Extract cursor for next page
				const nextCursor = extractCursorFromUrl(response.data.next);

				// Build response envelope
				logger.toolComplete("search_tango_grants", true, Date.now() - startTime, {
					returned: normalizedOpportunities.length,
				});

				const result = {
					data: normalizedOpportunities,
					total: response.data.total || response.data.count || normalizedOpportunities.length,
					returned: normalizedOpportunities.length,
					filters: sanitized,
					pagination: {
						limit: sanitized.limit || 10,
						has_more: !!nextCursor || !!response.data.next,
						next_cursor: nextCursor,
						ordering: sanitized.ordering ? getOrderingDescription(sanitized.ordering) : undefined,
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
				logger.error(
					"Unexpected error in search_tango_grants",
					error instanceof Error ? error : new Error(String(error)),
					{ tool: "search_tango_grants" }
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
								2
							),
						},
					],
				};
			}
		}
	);
}
