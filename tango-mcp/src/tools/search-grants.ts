/**
 * Search Grants Tool
 *
 * Searches federal grants and financial assistance awards from USASpending through Tango API.
 * Includes client-side filtering for recipient name/UEI and award amount ranges.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SearchGrantsArgs } from "@/types/tool-args";
import type { Env } from "@/types/env";
import { TangoApiClient } from "@/api/tango-client";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import { normalizeGrant } from "@/utils/normalizer";
import { z } from "zod";

/**
 * Register search grants tool with the MCP server
 */
export function registerSearchGrantsTool(server: McpServer, env: Env): void {
	server.tool(
		"search_tango_grants",
		"Search federal grants and financial assistance awards from USASpending through Tango's unified API. Returns grant details including recipient information (name, UEI, type), agency details, award amounts, CFDA numbers, and project information. Supports filtering by: free-text search, awarding agency, CFDA number, date ranges. Client-side filtering for recipient name/UEI and award amount ranges. Useful for finding grants by recipient, agency grant distribution analysis, and research funding opportunities. Maximum 100 results per request.",
		{
			query: z
				.string()
				.optional()
				.describe(
					"Free-text search across grant descriptions and titles. Example: 'education' or 'research'"
				),
			agency: z
				.string()
				.optional()
				.describe(
					"Awarding agency name or code. Example: 'Department of Education' or 'ED'"
				),
			recipient_name: z
				.string()
				.optional()
				.describe(
					"Recipient organization name (client-side filtering). Case-insensitive partial match. Example: 'Stanford University'"
				),
			recipient_uei: z
				.string()
				.optional()
				.describe(
					"Recipient Unique Entity Identifier (client-side filtering). 12-character alphanumeric. Example: 'A1B2C3D4E5F6'"
				),
			cfda_number: z
				.string()
				.optional()
				.describe(
					"Catalog of Federal Domestic Assistance number. Example: '84.027' (Special Education Grants)"
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
			award_amount_min: z
				.number()
				.optional()
				.describe(
					"Minimum award amount in dollars (client-side filtering). Example: 100000"
				),
			award_amount_max: z
				.number()
				.optional()
				.describe(
					"Maximum award amount in dollars (client-side filtering). Example: 1000000"
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

				// Build API parameters (excluding client-side filters)
				const params: Record<string, unknown> = {};
				if (sanitized.query) params.search = sanitized.query;
				if (sanitized.agency) params.agency = sanitized.agency;
				if (sanitized.cfda_number) params.cfda_number = sanitized.cfda_number;
				if (sanitized.posted_date_after)
					params.posted_date_after = sanitized.posted_date_after;
				if (sanitized.posted_date_before)
					params.posted_date_before = sanitized.posted_date_before;

				// Request more results for client-side filtering
				params.limit = sanitized.limit || 10;

				// Call Tango API
				const client = new TangoApiClient(env);
				const response = await client.searchGrants(params, apiKey);

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
				let normalizedGrants = (response.data.results || []).map(
					normalizeGrant
				);

				// Apply client-side filtering
				if (sanitized.recipient_name) {
					const recipientLower = sanitized.recipient_name.toLowerCase();
					normalizedGrants = normalizedGrants.filter((grant) =>
						grant.recipient.name.toLowerCase().includes(recipientLower)
					);
				}

				if (sanitized.recipient_uei) {
					normalizedGrants = normalizedGrants.filter(
						(grant) =>
							grant.recipient.uei === sanitized.recipient_uei
					);
				}

				if (sanitized.award_amount_min !== undefined) {
					normalizedGrants = normalizedGrants.filter(
						(grant) => grant.award_amount >= sanitized.award_amount_min!
					);
				}

				if (sanitized.award_amount_max !== undefined) {
					normalizedGrants = normalizedGrants.filter(
						(grant) => grant.award_amount <= sanitized.award_amount_max!
					);
				}

				// Build response envelope
				const result = {
					data: normalizedGrants,
					total: response.data.total || response.data.count || normalizedGrants.length,
					returned: normalizedGrants.length,
					filters: sanitized,
					client_side_filters: {
						applied: !!(
							sanitized.recipient_name ||
							sanitized.recipient_uei ||
							sanitized.award_amount_min ||
							sanitized.award_amount_max
						),
						recipient_name: !!sanitized.recipient_name,
						recipient_uei: !!sanitized.recipient_uei,
						award_amount_range: !!(
							sanitized.award_amount_min || sanitized.award_amount_max
						),
					},
					pagination: {
						limit: sanitized.limit || 10,
						has_more:
							normalizedGrants.length >= (sanitized.limit || 10) &&
							normalizedGrants.length <
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
