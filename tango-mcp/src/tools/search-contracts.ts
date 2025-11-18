/**
 * Search Contracts Tool
 *
 * Searches federal contract awards from FPDS through Tango API.
 * Supports filtering by vendor, agency, industry codes, dates, and set-aside types.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SearchContractsArgs } from "@/types/tool-args";
import type { Env } from "@/types/env";
import { TangoApiClient } from "@/api/tango-client";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import { normalizeContract } from "@/utils/normalizer";
import { z } from "zod";

/**
 * Register search contracts tool with the MCP server
 */
export function registerSearchContractsTool(server: McpServer): void {
	server.tool(
		"search_tango_contracts",
		"Search federal contract awards from FPDS (Federal Procurement Data System) through Tango's unified API. Returns contract details including vendor information (name, UEI, DUNS), agency details, award amounts, NAICS/PSC codes, set-aside types, and performance location. Supports filtering by: free-text search, vendor name/UEI, awarding agency, industry classifications (NAICS/PSC), date ranges, and set-aside categories. Useful for finding contracts by vendor, agency spending analysis, market research, and competitor analysis. Maximum 100 results per request.",
		{
			query: z
				.string()
				.optional()
				.describe(
					"Free-text search across contract descriptions and titles. Example: 'IT services' or 'cloud computing'"
				),
			vendor_name: z
				.string()
				.optional()
				.describe(
					"Vendor/contractor name filter. Case-insensitive partial match. Example: 'Lockheed Martin'"
				),
			vendor_uei: z
				.string()
				.optional()
				.describe(
					"Unique Entity Identifier (12-character alphanumeric). For exact vendor matching. Example: 'J3RW5C5KVLZ1'"
				),
			awarding_agency: z
				.string()
				.optional()
				.describe(
					"Awarding agency name or code. Example: 'Department of Defense' or 'DOD'"
				),
			naics_code: z
				.string()
				.optional()
				.describe(
					"NAICS industry classification code (2-6 digits). Example: '541512' for computer systems design"
				),
			psc_code: z
				.string()
				.optional()
				.describe(
					"Product/Service Code. Example: 'D302' for IT and telecom"
				),
			award_date_start: z
				.string()
				.optional()
				.describe(
					"Earliest award date to include (YYYY-MM-DD format). Example: '2024-01-01'"
				),
			award_date_end: z
				.string()
				.optional()
				.describe(
					"Latest award date to include (YYYY-MM-DD format). Example: '2024-12-31'"
				),
			set_aside_type: z
				.string()
				.optional()
				.describe(
					"Contract set-aside category. Values: 'SBA' (Small Business), 'WOSB' (Women-Owned), 'SDVOSB' (Service-Disabled Veteran), '8A', 'HUBZone'. Leave empty for all types."
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
		async (args: SearchContractsArgs, { env }: { env: Env }) => {
			const startTime = Date.now();

			try {
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
				if (sanitized.vendor_name) params.recipient = sanitized.vendor_name;
				if (sanitized.vendor_uei) params.uei = sanitized.vendor_uei;
				if (sanitized.awarding_agency)
					params.awarding_agency = sanitized.awarding_agency;
				if (sanitized.naics_code) params.naics = sanitized.naics_code;
				if (sanitized.psc_code) params.psc = sanitized.psc_code;
				if (sanitized.award_date_start)
					params.award_date_gte = sanitized.award_date_start;
				if (sanitized.award_date_end)
					params.award_date_lte = sanitized.award_date_end;
				if (sanitized.set_aside_type)
					params.set_aside = sanitized.set_aside_type;

				params.limit = sanitized.limit || 10;

				// Call Tango API
				const client = new TangoApiClient(env);
				const response = await client.searchContracts(params, apiKey);

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
				const normalizedContracts = (response.data.results || []).map(
					normalizeContract
				);

				// Build response envelope
				const result = {
					data: normalizedContracts,
					total: response.data.total || response.data.count || normalizedContracts.length,
					returned: normalizedContracts.length,
					filters: sanitized,
					pagination: {
						limit: sanitized.limit || 10,
						has_more:
							normalizedContracts.length >= (sanitized.limit || 10) &&
							normalizedContracts.length <
								(response.data.total || response.data.count || 0),
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
