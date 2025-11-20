/**
 * Get Contract Detail Tool
 *
 * Retrieves detailed information for a specific federal contract by key/award ID.
 * Returns comprehensive contract data including vendor, agency, financials, and performance data.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "@/types/env";
import { TangoApiClient } from "@/api/tango-client";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import type { CacheManager } from "@/cache/kv-cache";
import { getLogger } from "@/utils/logger";
import { z } from "zod";

/**
 * Register get contract detail tool with the MCP server
 */
export function registerGetContractDetailTool(
	server: McpServer,
	env: Env,
	cache?: CacheManager,
	userApiKey?: string
): void {
	server.tool(
		"get_contract_detail",
		"Get detailed information for a specific federal contract by its unique key/award ID from FPDS (Federal Procurement Data System). Returns comprehensive contract details including full vendor information, awarding agency and office details, complete financial breakdown (obligated amounts, total contract value, base and options), period of performance dates, NAICS/PSC classifications, set-aside information, place of performance, contract type and status, award history, and related procurement information. Use this when you have a contract key from search results and need full details. Contract keys are in format like 'CONT_AWD_xxxxx' or 'CONT_IDV_xxxxx'.",
		{
			contract_key: z
				.string()
				.describe(
					"Contract key/award ID (REQUIRED). Format: 'CONT_AWD_xxxxx' or 'CONT_IDV_xxxxx'. Example: 'CONT_AWD_89243424FEE000468_8900_89243423AEE000005_8900'"
				),
		},
		async (args) => {
			const startTime = Date.now();
			const logger = getLogger();

			try {
				// Log tool invocation
				logger.toolInvocation("get_contract_detail", args, startTime);

				// Sanitize input
				const sanitized = sanitizeToolArgs(args);

				// Validate contract_key parameter
				if (!sanitized.contract_key || typeof sanitized.contract_key !== "string") {
					logger.error("Missing or invalid contract_key parameter", undefined, {
						tool: "get_contract_detail",
					});
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										error: "contract_key parameter is required",
										error_code: "MISSING_PARAMETER",
										parameter: "contract_key",
										suggestion:
											"Provide a contract key in format 'CONT_AWD_xxxxx' or 'CONT_IDV_xxxxx'",
										example: "CONT_AWD_89243424FEE000468_8900_89243423AEE000005_8900",
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
					logger.error("Missing API key", undefined, {
						tool: "get_contract_detail",
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
									2
								),
							},
						],
					};
				}

				// Call Tango API
				logger.info("Calling Tango API", {
					endpoint: "getContractDetail",
					contract_key: sanitized.contract_key,
				});
				const client = new TangoApiClient(env, cache);
				const response = await client.getContractDetail(
					sanitized.contract_key as string,
					apiKey
				);
				logger.apiCall(
					`/contracts/${sanitized.contract_key}`,
					"GET",
					response.status || 200,
					Date.now() - startTime
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
										suggestion: "Check the contract key and try again",
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

				// Build response envelope
				logger.toolComplete(
					"get_contract_detail",
					true,
					Date.now() - startTime,
					{
						contract_key: sanitized.contract_key,
						cached: response.cache?.hit || false,
					}
				);

				const result = {
					data: response.data,
					contract_key: sanitized.contract_key,
					execution: {
						duration_ms: Date.now() - startTime,
						cached: response.cache?.hit || false,
						api_calls: response.cache?.hit ? 0 : 1,
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
					"Unexpected error in get_tango_contract_detail",
					error instanceof Error ? error : new Error(String(error)),
					{ tool: "get_contract_detail" }
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
