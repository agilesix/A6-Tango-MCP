/**
 * Get Spending Summary Tool
 *
 * Generates aggregated spending analytics by various dimensions.
 * Uses client-side aggregation of contract/grant data.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "@/types/env";
import { TangoApiClient } from "@/api/tango-client";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import { normalizeContract } from "@/utils/normalizer";
import type { CacheManager } from "@/cache/kv-cache";
import { getLogger } from "@/utils/logger";
import { z } from "zod";
import { NAICS_DESCRIPTIONS } from "@/data/naics-codes";

/**
 * Register get spending summary tool with the MCP server
 */
export function registerGetSpendingSummaryTool(
	server: McpServer,
	env: Env,
	cache?: CacheManager,
	userApiKey?: string
): void {
	server.tool(
		"get_spending_summary",
		"Generate aggregated spending analytics from federal contracts and grants through Tango's unified API. Returns total spending, contract/grant counts, and breakdowns by agency, vendor, NAICS code, PSC code, or month. Supports filtering by: awarding agency, vendor UEI, fiscal year, and award type (contracts/grants/all). Aggregation dimensions: 'agency' (by awarding agency), 'vendor' (by recipient), 'naics' (by industry code), 'psc' (by product/service code), 'month' (by award month). Useful for spending analysis, budget tracking, market sizing, and trend identification. Maximum 100 contracts analyzed per request.",
		{
			awarding_agency: z
				.string()
				.optional()
				.describe(
					"Awarding agency name or code to filter spending. Example: 'Department of Defense' or 'DOD'"
				),
			vendor_uei: z
				.string()
				.optional()
				.describe(
					"Vendor Unique Entity Identifier to filter spending. Example: 'J3RW5C5KVLZ1'"
				),
			fiscal_year: z
				.number()
				.int()
				.min(2000)
				.max(2030)
				.optional()
				.describe(
					"Fiscal year to filter spending (YYYY format). Example: 2024"
				),
			award_type: z
				.enum(["contracts", "grants", "all"])
				.default("contracts")
				.optional()
				.describe(
					"Type of awards to include. 'contracts' = contracts only (default), 'grants' = grants only, 'all' = both"
				),
			group_by: z
				.enum(["agency", "vendor", "naics", "psc", "month"])
				.default("vendor")
				.optional()
				.describe(
					"Aggregation dimension. 'agency' = by awarding agency, 'vendor' = by recipient (default), 'naics' = by industry code, 'psc' = by product/service code, 'month' = by award month"
				),
			limit: z
				.number()
				.int()
				.min(1)
				.max(100)
				.default(100)
				.optional()
				.describe(
					"Maximum records to analyze for aggregation. Default: 100, Maximum: 100. Higher values give more complete analysis but slower response."
				),
		},
		async (args) => {
			const startTime = Date.now();
			const logger = getLogger();

			try {
				logger.toolInvocation("get_spending_summary", args, startTime);

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
									2
								),
							},
						],
					};
				}

				// Build API parameters for contracts (for now, just contracts)
				const params: Record<string, unknown> = {};
				if (sanitized.awarding_agency)
					params.awarding_agency = sanitized.awarding_agency;
				if (sanitized.vendor_uei) params.uei = sanitized.vendor_uei;

				// Handle fiscal year (Oct 1 - Sep 30)
				if (sanitized.fiscal_year) {
					const fy = sanitized.fiscal_year;
					params.award_date_gte = `${fy - 1}-10-01`;
					params.award_date_lte = `${fy}-09-30`;
				}

				params.limit = sanitized.limit || 100;

				// Call Tango API with caching
				const client = new TangoApiClient(env, cache);
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

				// Normalize contracts
				const contracts = (response.data.results || []).map(normalizeContract);

				// Perform client-side aggregation
				const groupBy = sanitized.group_by || "vendor";
				const aggregation = new Map<string, { label: string; total: number; count: number }>();

				for (const contract of contracts) {
					let key: string;
					let label: string;

					switch (groupBy) {
						case "agency":
							key = contract.agency.code || contract.agency.name || "unknown";
							label = contract.agency.name || "Unknown Agency";
							break;
						case "naics": {
							key = contract.naics_code || "unknown";
							const naicsDesc =
								contract.naics_description ||
								NAICS_DESCRIPTIONS[key] ||
								"";
							label = `${contract.naics_code || "unknown"} - ${naicsDesc}`;
							break;
						}
						case "psc":
							key = contract.psc_code || "unknown";
							label = `${contract.psc_code || "unknown"} - ${contract.psc_description || ""}`;
							break;
						case "month":
							key = contract.award_date ? contract.award_date.substring(0, 7) : "unknown"; // YYYY-MM
							label = key;
							break;
						default:
							// Default to vendor grouping
							key = contract.vendor.uei || contract.vendor.name || "unknown";
							label = contract.vendor.name || "Unknown Vendor";
							break;
					}

					const existing = aggregation.get(key) || { label, total: 0, count: 0 };
					existing.total += contract.award_amount;
					existing.count += 1;
					aggregation.set(key, existing);
				}

				// Convert to sorted array
				const breakdown = Array.from(aggregation.entries())
					.map(([key, stats]) => ({
						key,
						label: stats.label,
						total_obligated: stats.total,
						contract_count: stats.count,
					}))
					.sort((a, b) => b.total_obligated - a.total_obligated)
					.slice(0, 20) // Top 20
					.map((item, index) => ({
						rank: index + 1,
						...item,
					}));

				// Calculate totals
				const totalObligated = contracts.reduce(
					(sum, c) => sum + c.award_amount,
					0
				);

				// Build response envelope
				const result = {
					total_contracts: contracts.length,
					total_obligated: totalObligated,
					breakdown,
					group_by: groupBy,
					award_type: sanitized.award_type || "contracts",
					fiscal_year: sanitized.fiscal_year || null,
					filters: {
						awarding_agency: sanitized.awarding_agency || null,
						vendor_uei: sanitized.vendor_uei || null,
					},
					page_info: {
						limit: sanitized.limit || 100,
						total_available: response.data.total || response.data.count || null,
						next_cursor: null,
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
