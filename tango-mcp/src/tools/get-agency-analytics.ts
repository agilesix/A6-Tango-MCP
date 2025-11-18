/**
 * Get Agency Analytics Tool
 *
 * Generates spending analytics for federal agencies using Tango's agency-specific endpoints.
 * Returns total spending, contract counts, and top vendors for a given agency.
 * Uses server-side data from /api/agencies/{code}/contracts/awarding/ endpoint.
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
 * Agency analytics result type
 */
interface AgencyAnalytics {
	agency_code: string;
	agency_name?: string;
	fiscal_year?: number;
	award_type: string;
	total_contracts: number;
	total_obligated: number;
	top_vendors: Array<{
		rank: number;
		vendor_name: string;
		vendor_uei: string;
		total_obligated: number;
		contract_count: number;
	}>;
	top_naics: Array<{
		rank: number;
		naics_code: string;
		naics_description: string;
		total_obligated: number;
		contract_count: number;
	}>;
	spending_by_month?: Array<{
		month: string;
		total_obligated: number;
		contract_count: number;
	}>;
	filters: {
		fiscal_year?: number;
		award_type: string;
	};
	page_info: {
		limit: number;
		total_available?: number;
	};
	execution: {
		duration_ms: number;
		cached: boolean;
		api_calls: number;
	};
}

/**
 * Register get agency analytics tool with the MCP server
 */
export function registerGetAgencyAnalyticsTool(
	server: McpServer,
	env: Env,
	cache?: CacheManager,
	userApiKey?: string
): void {
	server.tool(
		"get_tango_agency_analytics",
		"Generate comprehensive spending analytics for a specific federal agency using Tango's unified API. Returns total obligated spending, contract counts, top vendors, top NAICS industry codes, and optional monthly spending trends. Supports filtering by fiscal year and award type (contracts only for now). Useful for agency spending analysis, vendor landscape research, market sizing, and budget tracking. Example: Get DOD spending in FY2024, or analyze Department of Education contract patterns.",
		{
			agency_code: z
				.string()
				.min(1)
				.max(10)
				.describe(
					"Agency code (REQUIRED). Examples: 'DOD' (Department of Defense), 'GSA' (General Services Administration), 'ED' (Department of Education), '7000' (Department of Homeland Security)"
				),
			fiscal_year: z
				.number()
				.int()
				.min(2000)
				.max(2030)
				.optional()
				.describe(
					"Fiscal year to filter spending (YYYY format). Federal fiscal years run Oct 1 - Sep 30. Example: 2024 = Oct 1, 2023 to Sep 30, 2024"
				),
			award_type: z
				.enum(["contracts"])
				.default("contracts")
				.optional()
				.describe(
					"Type of awards to analyze. Currently only 'contracts' is supported (uses FPDS data). Future: 'grants', 'all'"
				),
			include_trends: z
				.boolean()
				.default(false)
				.optional()
				.describe(
					"Include monthly spending trends. Default: false. When true, returns spending breakdown by month"
				),
			limit: z
				.number()
				.int()
				.min(1)
				.max(100)
				.default(100)
				.optional()
				.describe(
					"Maximum contracts to analyze for aggregation. Default: 100, Maximum: 100. Higher values give more complete analysis but slower response."
				),
		},
		async (args) => {
			const startTime = Date.now();
			const logger = getLogger();

			try {
				logger.toolInvocation("get_tango_agency_analytics", args, startTime);

				// Sanitize input
				const sanitized = sanitizeToolArgs(args);

				// Validate agency_code
				if (!sanitized.agency_code) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										error: "Agency code is required",
										error_code: "MISSING_AGENCY_CODE",
										suggestion:
											"Provide an agency code like 'DOD', 'GSA', 'ED', or '7000'",
										recoverable: true,
									},
									null,
									2
								),
							},
						],
					};
				}

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

				// Build API parameters
				const params: Record<string, unknown> = {};

				// Handle fiscal year (Oct 1 - Sep 30)
				if (sanitized.fiscal_year) {
					const fy = sanitized.fiscal_year;
					params.fiscal_year = fy;
				}

				params.limit = sanitized.limit || 100;
				params.ordering = "-award_amount"; // Get largest contracts first

				// Call Tango API with caching
				const client = new TangoApiClient(env, cache);
				const response = await client.getAgencyContracts(
					sanitized.agency_code,
					"awarding",
					params,
					apiKey
				);

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
										suggestion:
											"Check your agency code and parameters. Valid codes: DOD, GSA, ED, etc.",
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

				if (contracts.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										error: "No contracts found for this agency",
										error_code: "NO_DATA",
										suggestion:
											"Try a different fiscal year or check the agency code",
										recoverable: true,
										filters: {
											agency_code: sanitized.agency_code,
											fiscal_year: sanitized.fiscal_year,
										},
									},
									null,
									2
								),
							},
						],
					};
				}

				// Aggregate by vendor
				const vendorMap = new Map<
					string,
					{ name: string; total: number; count: number }
				>();
				for (const contract of contracts) {
					const uei = contract.vendor.uei || "UNKNOWN";
					const existing = vendorMap.get(uei) || {
						name: contract.vendor.name || "Unknown Vendor",
						total: 0,
						count: 0,
					};
					existing.total += contract.award_amount;
					existing.count += 1;
					vendorMap.set(uei, existing);
				}

				// Aggregate by NAICS
				const naicsMap = new Map<
					string,
					{ description: string; total: number; count: number }
				>();
				for (const contract of contracts) {
					const code = contract.naics_code || "UNKNOWN";
					const existing = naicsMap.get(code) || {
						description:
							contract.naics_description ||
							NAICS_DESCRIPTIONS[code] ||
							`NAICS ${code}`,
						total: 0,
						count: 0,
					};
					existing.total += contract.award_amount;
					existing.count += 1;
					naicsMap.set(code, existing);
				}

				// Optionally aggregate by month
				let monthlyTrends: Array<{
					month: string;
					total_obligated: number;
					contract_count: number;
				}> = [];

				if (sanitized.include_trends) {
					const monthMap = new Map<string, { total: number; count: number }>();
					for (const contract of contracts) {
						if (contract.award_date) {
							const month = contract.award_date.substring(0, 7); // YYYY-MM
							const existing = monthMap.get(month) || { total: 0, count: 0 };
							existing.total += contract.award_amount;
							existing.count += 1;
							monthMap.set(month, existing);
						}
					}

					monthlyTrends = Array.from(monthMap.entries())
						.map(([month, stats]) => ({
							month,
							total_obligated: stats.total,
							contract_count: stats.count,
						}))
						.sort((a, b) => a.month.localeCompare(b.month));
				}

				// Convert to sorted arrays
				const topVendors = Array.from(vendorMap.entries())
					.map(([uei, stats]) => ({
						vendor_uei: uei,
						vendor_name: stats.name,
						total_obligated: stats.total,
						contract_count: stats.count,
					}))
					.sort((a, b) => b.total_obligated - a.total_obligated)
					.slice(0, 20)
					.map((item, index) => ({
						rank: index + 1,
						...item,
					}));

				const topNaics = Array.from(naicsMap.entries())
					.map(([code, stats]) => ({
						naics_code: code,
						naics_description: stats.description,
						total_obligated: stats.total,
						contract_count: stats.count,
					}))
					.sort((a, b) => b.total_obligated - a.total_obligated)
					.slice(0, 10)
					.map((item, index) => ({
						rank: index + 1,
						...item,
					}));

				// Calculate totals
				const totalObligated = contracts.reduce(
					(sum, c) => sum + c.award_amount,
					0
				);

				// Build response
				const result: AgencyAnalytics = {
					agency_code: sanitized.agency_code,
					agency_name:
						contracts.length > 0 ? (contracts[0].agency.name || undefined) : undefined,
					fiscal_year: sanitized.fiscal_year,
					award_type: sanitized.award_type || "contracts",
					total_contracts: contracts.length,
					total_obligated: totalObligated,
					top_vendors: topVendors,
					top_naics: topNaics,
					spending_by_month: sanitized.include_trends ? monthlyTrends : undefined,
					filters: {
						fiscal_year: sanitized.fiscal_year,
						award_type: sanitized.award_type || "contracts",
					},
					page_info: {
						limit: sanitized.limit || 100,
						total_available: response.data.total || response.data.count || undefined,
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
