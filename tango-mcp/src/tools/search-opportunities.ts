/**
 * Search Opportunities Tool
 *
 * Searches federal contract opportunities, forecasts, and solicitation notices.
 * Provides access to active and upcoming contracting opportunities.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SearchOpportunitiesArgs } from "@/types/tool-args";
import type { Env } from "@/types/env";
import { TangoApiClient } from "@/api/tango-client";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import { normalizeOpportunity } from "@/utils/normalizer";
import { getLogger } from "@/utils/logger";
import { z } from "zod";

/**
 * Register search opportunities tool with the MCP server
 */
export function registerSearchOpportunitiesTool(server: McpServer, env: Env): void {
	server.tool(
		"search_tango_opportunities",
		"Search federal contract opportunities, forecasts, and solicitation notices through Tango's unified API. Returns opportunity details including solicitation number, title, type (solicitation/forecast), status, awarding office, posted date, response deadline, NAICS code, set-aside type, place of performance, description, and SAM.gov link. Supports filtering by: free-text search, agency, NAICS code, set-aside type, posted date range, response deadline, active status, and notice type. Useful for identifying bid opportunities, market intelligence, and procurement planning. Maximum 100 results per request.",
		{
			query: z
				.string()
				.optional()
				.describe(
					"Free-text search across opportunity titles and descriptions. Example: 'cybersecurity' or 'cloud services'"
				),
			agency: z
				.string()
				.optional()
				.describe(
					"Agency name or code. Example: 'Department of Defense' or 'DOD'"
				),
			naics_code: z
				.string()
				.optional()
				.describe(
					"NAICS industry classification code (2-6 digits). Example: '541512' for computer systems design"
				),
			set_aside_type: z
				.string()
				.optional()
				.describe(
					"Set-aside category. Values: 'SBA', 'WOSB', 'SDVOSB', '8A', 'HUBZone'. Leave empty for all types."
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
			response_deadline_after: z
				.string()
				.optional()
				.describe(
					"Minimum response deadline (YYYY-MM-DD format). Only opportunities with deadlines on or after this date. Example: '2024-12-01'"
				),
			active: z
				.boolean()
				.optional()
				.describe(
					"Filter by active status. true = active opportunities only, false = inactive/closed, undefined = all"
				),
			notice_type: z
				.string()
				.optional()
				.describe(
					"Notice type code. Example: 'f' for forecasted opportunities, 's' for solicitations"
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
		},
		async (args) => {
			const startTime = Date.now();
			const logger = getLogger();

			try {
				logger.toolInvocation("search_tango_opportunities", args, startTime);

				// Sanitize input
				const sanitized = sanitizeToolArgs(args);

				// Get API key from environment
				const apiKey = env.TANGO_API_KEY;
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
											"Ensure TANGO_API_KEY environment variable is set",
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
				if (sanitized.naics_code) params.naics = sanitized.naics_code;
				if (sanitized.set_aside_type)
					params.set_aside = sanitized.set_aside_type;
				if (sanitized.posted_date_after)
					params.posted_date_after = sanitized.posted_date_after;
				if (sanitized.posted_date_before)
					params.posted_date_before = sanitized.posted_date_before;
				if (sanitized.response_deadline_after)
					params.response_deadline_after = sanitized.response_deadline_after;
				if (sanitized.active !== undefined) params.active = sanitized.active;
				if (sanitized.notice_type) params.notice_type = sanitized.notice_type;

				params.limit = sanitized.limit || 10;

				// Call Tango API
				const client = new TangoApiClient(env);
				const response = await client.searchOpportunities(params, apiKey);

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
					normalizeOpportunity
				);

				// Build response envelope
				const result = {
					data: normalizedOpportunities,
					total: response.data.total || response.data.count || normalizedOpportunities.length,
					returned: normalizedOpportunities.length,
					filters: sanitized,
					pagination: {
						limit: sanitized.limit || 10,
						has_more:
							normalizedOpportunities.length >= (sanitized.limit || 10) &&
							normalizedOpportunities.length <
								(response.data.total || response.data.count || 0),
						next_cursor: response.data.next || null,
					},
					execution: {
						duration_ms: Date.now() - startTime,
						cached: false,
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
