/**
 * Search Subawards Tool
 *
 * Searches federal subawards (subcontracts) from FSRS through Tango API.
 * Supports filtering by prime contractor, subcontractor, agencies, and fiscal years.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TangoApiClient } from "@/api/tango-client";
import type { CacheManager } from "@/cache/kv-cache";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import type { Env } from "@/types/env";
import { getLogger } from "@/utils/logger";
import { normalizeSubaward } from "@/utils/normalizer";

/**
 * Extract page number from pagination URL
 */
function extractPageFromUrl(url: string | null | undefined): number | undefined {
	if (!url) return undefined;

	try {
		const urlObj = new URL(url);
		const pageParam = urlObj.searchParams.get('page');
		return pageParam ? parseInt(pageParam, 10) : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Register search subawards tool with the MCP server
 */
export function registerSearchSubawardsTool(
	server: McpServer,
	env: Env,
	cache?: CacheManager,
	userApiKey?: string,
): void {
	server.tool(
		"search_subawards",
		"Search federal subawards (subcontracts awarded by prime contractors to smaller businesses). Data from FSRS (Federal Subaward Reporting System) for awards over $30,000. Essential for small businesses looking for teaming partners, analyzing supply chain relationships, and identifying subcontracting opportunities. Supports filtering by prime contractor (UEI), subcontractor (UEI), agencies, fiscal years, and prime award. Use this to find who is getting paid by prime contractors, identify active subcontractors in specific industries, and research teaming relationships. Federal fiscal years: FY2024 = Oct 1, 2023 to Sep 30, 2024. Returns offset-based pagination (page numbers). Known API limitations: (1) recipient parameter may trigger 500 errors - use prime_uei or sub_uei instead, (2) many results have incomplete data (missing contractor names/amounts) - cross-reference with vendor profiles for full details, (3) agency filtering works best with agency codes rather than full names. These are upstream API data quality issues.",
		{
			award_key: z.string().optional().describe(
				"Prime award key/ID to find all subawards under that contract. Example: 'CONT_AWD_70SBUR24C00000004_7000_-NONE-_-NONE-'"
			),
			prime_uei: z.string().optional().describe(
				"Prime contractor Unique Entity Identifier (12-character alphanumeric). Find all subawards issued by this prime contractor. Example: 'J3RW5C5KVLZ1'"
			),
			sub_uei: z.string().optional().describe(
				"Subcontractor Unique Entity Identifier. Find all subawards received by this subcontractor. Example: 'K9LMN3P4QRST'"
			),
			awarding_agency: z.string().optional().describe(
				"Awarding agency name or code. Example: 'VA' or 'Department of Veterans Affairs'"
			),
			funding_agency: z.string().optional().describe(
				"Funding agency name or code (may differ from awarding agency)"
			),
			recipient: z.string().optional().describe(
				"Search by recipient name or UEI. Searches both prime and sub recipients. Example: 'Accenture Federal'"
			),
			fiscal_year: z.number().int().optional().describe(
				"Exact fiscal year (YYYY). Example: 2024"
			),
			fiscal_year_start: z.number().int().optional().describe(
				"Earliest fiscal year to include (YYYY). Example: 2022"
			),
			fiscal_year_end: z.number().int().optional().describe(
				"Latest fiscal year to include (YYYY). Example: 2024"
			),
			limit: z.number().int().min(1).max(100).default(25).optional().describe(
				"Number of results per page (1-100, default: 25)"
			),
			page: z.number().int().min(1).optional().describe(
				"Page number for offset-based pagination (starts at 1). Use with limit to paginate through results."
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
				logger.toolInvocation("search_subawards", args, startTime);

				// Sanitize input
				const sanitized = sanitizeToolArgs(args);

				// Require API key
				const apiKey = userApiKey || env.TANGO_API_KEY;
				if (!apiKey) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										error: "API key required for subaward search",
										error_code: "MISSING_API_KEY",
										suggestion: "Configure TANGO_API_KEY environment variable",
										recoverable: false,
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

				// Award and entity filters
				if (sanitized.award_key) params.award_key = sanitized.award_key;
				if (sanitized.prime_uei) params.prime_uei = sanitized.prime_uei;
				if (sanitized.sub_uei) params.sub_uei = sanitized.sub_uei;

				// Agency filters
				if (sanitized.awarding_agency) params.awarding_agency = sanitized.awarding_agency;
				if (sanitized.funding_agency) params.funding_agency = sanitized.funding_agency;

				// Recipient search
				if (sanitized.recipient) params.recipient = sanitized.recipient;

				// Fiscal year filters
				if (sanitized.fiscal_year) {
					params.fiscal_year_gte = sanitized.fiscal_year.toString();
					params.fiscal_year_lte = sanitized.fiscal_year.toString();
				} else {
					if (sanitized.fiscal_year_start) params.fiscal_year_gte = sanitized.fiscal_year_start.toString();
					if (sanitized.fiscal_year_end) params.fiscal_year_lte = sanitized.fiscal_year_end.toString();
				}

				// Pagination (offset-based)
				params.limit = sanitized.limit || 25;
				if (sanitized.page) params.page = sanitized.page;

				// Add shape parameter if provided
				if (sanitized.shape) params.shape = sanitized.shape;

				// Call Tango API with caching
				const client = new TangoApiClient(env, cache);
				const response = await client.searchSubawards(params, apiKey);

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
									2,
								),
							},
						],
					};
				}

				// When shape parameter is provided, return raw API response (no normalization)
				// This preserves the shape parameter's payload reduction (60-85%)
				const results = response.data.results || [];
				const normalizedSubawards = sanitized.shape
					? results
					: results.map(normalizeSubaward);

				// Extract pagination info
				const nextPage = extractPageFromUrl(response.data.next);
				const prevPage = extractPageFromUrl(response.data.previous);

				// Build response envelope
				logger.toolComplete(
					"search_subawards",
					true,
					Date.now() - startTime,
					{
						returned: normalizedSubawards.length,
						total: response.data.total || response.data.count,
					},
				);

				const result = {
					data: normalizedSubawards,
					total: response.data.total || response.data.count || normalizedSubawards.length,
					returned: normalizedSubawards.length,
					filters: sanitized,
					pagination: {
						limit: sanitized.limit || 25,
						current_page: sanitized.page || 1,
						next_page: nextPage,
						previous_page: prevPage,
						has_more: !!nextPage,
						has_previous: (sanitized.page || 1) > 1,
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
					"Unexpected error in search_tango_subawards",
					error instanceof Error ? error : new Error(String(error)),
					{ tool: "search_subawards" }
				);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									error: error instanceof Error ? error.message : "Unknown error",
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
