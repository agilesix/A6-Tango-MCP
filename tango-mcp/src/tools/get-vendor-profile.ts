/**
 * Get Vendor Profile Tool
 *
 * Retrieves comprehensive entity profiles from SAM.gov data through Tango API.
 * Provides detailed vendor information including business details, contacts, and performance history.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "@/types/env";
import { TangoApiClient } from "@/api/tango-client";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import { normalizeVendor } from "@/utils/normalizer";
import type { CacheManager } from "@/cache/kv-cache";
import { getLogger } from "@/utils/logger";
import { z } from "zod";

/**
 * Register get vendor profile tool with the MCP server
 */
export function registerGetVendorProfileTool(
	server: McpServer,
	env: Env,
	cache?: CacheManager,
	userApiKey?: string
): void {
	server.tool(
		"get_tango_vendor_profile",
		"Retrieve comprehensive entity profile from SAM.gov data through Tango's unified API. Returns detailed vendor information including legal business name, DUNS, CAGE code, registration status, business types, physical/mailing addresses, points of contact, NAICS/PSC codes, certifications, performance summary (total contracts/grants and values), and federal_obligations (the PRIMARY vendor performance metric with active/total contract spending, subawards, and IDV counts). Required parameter: vendor UEI (Unique Entity Identifier). Useful for vendor due diligence, capability assessment, and contact information lookup.",
		{
			uei: z
				.string()
				.length(12)
				.regex(/^[A-Z0-9]{12}$/i)
				.describe(
					"Unique Entity Identifier (12-character alphanumeric, required). Example: 'J3RW5C5KVLZ1'. Can be obtained from search_tango_contracts or search_tango_grants results."
				),
			include_history: z
				.boolean()
				.default(false)
				.optional()
				.describe(
					"Include recent contract and grant history. Default: false. Set to true to fetch recent awards history."
				),
			history_limit: z
				.number()
				.int()
				.min(1)
				.max(50)
				.default(10)
				.optional()
				.describe(
					"Maximum number of history records to fetch per type (contracts and subawards). Default: 10. Only used when include_history is true."
				),
		},
		async (args) => {
			const startTime = Date.now();
			const logger = getLogger();

			try {
				logger.toolInvocation("get_tango_vendor_profile", args, startTime);

				// Sanitize input
				const sanitized = sanitizeToolArgs(args);

				// Validate required parameter
				if (!sanitized.uei) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										error: "Missing required parameter: uei",
										error_code: "MISSING_PARAMETER",
										parameter: "uei",
										suggestion:
											"Provide a 12-character Unique Entity Identifier. You can search by vendor name first using search_tango_contracts with vendor_name parameter.",
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

				// Call Tango API with caching
				const client = new TangoApiClient(env, cache);
				let apiCalls = 0;

				// Get main vendor profile
				const response = await client.getVendorProfile(
					sanitized.uei,
					apiKey
				);
				apiCalls++;

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
											response.status === 404
												? "Vendor not found. Check the UEI and try again."
												: "Check your parameters and try again",
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

				// Normalize vendor profile
				const normalizedVendor = normalizeVendor(response.data);

				// Fetch history if requested
				if (sanitized.include_history) {
					const limit = sanitized.history_limit || 10;

					try {
						// Fetch contracts and subawards in parallel
						const [contractsResponse, subawardsResponse] = await Promise.all([
							client.getVendorContracts(
								sanitized.uei,
								{ limit: limit.toString() },
								apiKey
							),
							client.getVendorGrants(
								sanitized.uei,
								{ limit: limit.toString() },
								apiKey
							),
						]);
						apiCalls += 2;

						// Add contract history
						if (contractsResponse.success && contractsResponse.data?.results) {
							normalizedVendor.contract_history = contractsResponse.data.results.map(
								(contract) => ({
									piid: contract.piid,
									title: contract.title || contract.description,
									award_date: contract.award_date,
									amount: contract.obligated || contract.total_contract_value,
								})
							);
						}

						// Add subaward history
						if (subawardsResponse.success && subawardsResponse.data?.results) {
							normalizedVendor.subaward_history = subawardsResponse.data.results.map(
								(grant) => ({
									award_id: grant.fain || grant.grant_id,
									title: grant.title || grant.description,
									award_date: grant.award_date,
									amount: grant.award_amount || grant.total_funding_amount,
								})
							);
						}

						logger.info("Entity history fetched successfully", {
							uei: sanitized.uei,
							contracts_count: normalizedVendor.contract_history?.length || 0,
							subawards_count: normalizedVendor.subaward_history?.length || 0,
						});
					} catch (error) {
						// Log error but don't fail entire request
						logger.warn("Failed to fetch entity history", {
							error: error instanceof Error ? error.message : "Unknown error",
							uei: sanitized.uei,
						});

						// Set empty arrays to indicate history was attempted but failed
						normalizedVendor.contract_history = [];
						normalizedVendor.subaward_history = [];
					}
				}

				// Build response envelope
				const result = {
					data: normalizedVendor,
					filters: sanitized,
					execution: {
						duration_ms: Date.now() - startTime,
						cached: false,
						api_calls: apiCalls,
						history_fetched: sanitized.include_history || false,
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
				// Handle validation errors specifically
				if (error instanceof Error && error.message.includes("Invalid UEI")) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										error: "Invalid UEI format",
										error_code: "INVALID_FORMAT",
										parameter: "uei",
										provided: args.uei,
										expected_format: "12-character alphanumeric",
										example: "J3RW5C5KVLZ1",
										recoverable: true,
									},
									null,
									2
								),
							},
						],
					};
				}

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
