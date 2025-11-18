/**
 * Get Opportunity Detail Tool
 *
 * Retrieves detailed information for a specific contract opportunity by opportunity ID.
 * Returns comprehensive opportunity data from SAM.gov.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "@/types/env";
import { TangoApiClient } from "@/api/tango-client";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import type { CacheManager } from "@/cache/kv-cache";
import { getLogger } from "@/utils/logger";
import { z } from "zod";

/**
 * Register get opportunity detail tool with the MCP server
 */
export function registerGetOpportunityDetailTool(
	server: McpServer,
	env: Env,
	cache?: CacheManager,
	userApiKey?: string
): void {
	server.tool(
		"get_tango_opportunity_detail",
		"Get detailed information for a specific federal contract opportunity by its unique opportunity ID from SAM.gov. Returns comprehensive opportunity details including full opportunity description and summary, solicitation number and notice information, notice type and status, active/inactive status, awarding agency and office details, posted date and response deadline, NAICS industry classification code, set-aside information, place of performance details, link to full solicitation on SAM.gov, point of contact information, amendment history, and related documents. Use this when you have an opportunity ID from search results and need full solicitation details. Opportunity IDs are UUID format strings.",
		{
			opportunity_id: z
				.string()
				.uuid()
				.describe(
					"Opportunity ID (REQUIRED). UUID format string identifying the opportunity. Example: 'a924c349-fa2a-4742-ac02-8075dee1c85d'"
				),
		},
		async (args) => {
			const startTime = Date.now();
			const logger = getLogger();

			try {
				// Log tool invocation
				logger.toolInvocation("get_tango_opportunity_detail", args, startTime);

				// Sanitize input
				const sanitized = sanitizeToolArgs(args);

				// Validate opportunity_id parameter
				if (
					!sanitized.opportunity_id ||
					typeof sanitized.opportunity_id !== "string"
				) {
					logger.error("Missing or invalid opportunity_id parameter", undefined, {
						tool: "get_tango_opportunity_detail",
					});
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										error:
											"opportunity_id parameter is required and must be a UUID string",
										error_code: "MISSING_PARAMETER",
										parameter: "opportunity_id",
										suggestion: "Provide a UUID format opportunity ID",
										example: "a924c349-fa2a-4742-ac02-8075dee1c85d",
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
						tool: "get_tango_opportunity_detail",
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
					endpoint: "getOpportunityDetail",
					opportunity_id: sanitized.opportunity_id,
				});
				const client = new TangoApiClient(env, cache);
				const response = await client.getOpportunityDetail(
					sanitized.opportunity_id as string,
					apiKey
				);
				logger.apiCall(
					`/opportunities/${sanitized.opportunity_id}`,
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
										suggestion: "Check the opportunity ID and try again",
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
					"get_tango_opportunity_detail",
					true,
					Date.now() - startTime,
					{
						opportunity_id: sanitized.opportunity_id,
						cached: response.cache?.hit || false,
					}
				);

				const result = {
					data: response.data,
					opportunity_id: sanitized.opportunity_id,
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
					"Unexpected error in get_tango_opportunity_detail",
					error instanceof Error ? error : new Error(String(error)),
					{ tool: "get_tango_opportunity_detail" }
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
