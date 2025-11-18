/**
 * Get Grant Detail Tool
 *
 * Retrieves detailed information for a specific grant opportunity by grant ID.
 * Returns comprehensive grant opportunity data from Grants.gov.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "@/types/env";
import { TangoApiClient } from "@/api/tango-client";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import type { CacheManager } from "@/cache/kv-cache";
import { getLogger } from "@/utils/logger";
import { z } from "zod";

/**
 * Register get grant detail tool with the MCP server
 */
export function registerGetGrantDetailTool(
	server: McpServer,
	env: Env,
	cache?: CacheManager,
	userApiKey?: string
): void {
	server.tool(
		"get_tango_grant_detail",
		"Get detailed information for a specific grant opportunity by its unique grant ID from Grants.gov. Returns comprehensive grant opportunity details including full opportunity description, agency information, important dates (posted, response, close, archive), CFDA numbers and titles, eligible applicant types and eligibility descriptions, funding categories and instruments, detailed funding information (award ceiling/floor, estimated total funding, expected number of awards), grantor contact information, additional information and links, opportunity status, and last updated timestamp. Use this when you have a grant ID from search results and need full opportunity details. Grant IDs are numeric integers.",
		{
			grant_id: z
				.number()
				.int()
				.positive()
				.describe(
					"Grant opportunity ID (REQUIRED). Numeric ID for the grant opportunity. Example: 12345"
				),
		},
		async (args) => {
			const startTime = Date.now();
			const logger = getLogger();

			try {
				// Log tool invocation
				logger.toolInvocation("get_tango_grant_detail", args, startTime);

				// Sanitize input
				const sanitized = sanitizeToolArgs(args);

				// Validate grant_id parameter
				if (!sanitized.grant_id || typeof sanitized.grant_id !== "number") {
					logger.error("Missing or invalid grant_id parameter", undefined, {
						tool: "get_tango_grant_detail",
					});
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										error: "grant_id parameter is required and must be a number",
										error_code: "MISSING_PARAMETER",
										parameter: "grant_id",
										suggestion: "Provide a numeric grant ID",
										example: 12345,
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
						tool: "get_tango_grant_detail",
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
					endpoint: "getGrantDetail",
					grant_id: sanitized.grant_id,
				});
				const client = new TangoApiClient(env, cache);
				const response = await client.getGrantDetail(
					sanitized.grant_id as number,
					apiKey
				);
				logger.apiCall(
					`/grants/${sanitized.grant_id}`,
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
										suggestion: "Check the grant ID and try again",
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
				logger.toolComplete("get_tango_grant_detail", true, Date.now() - startTime, {
					grant_id: sanitized.grant_id,
					cached: response.cache?.hit || false,
				});

				const result = {
					data: response.data,
					grant_id: sanitized.grant_id,
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
					"Unexpected error in get_tango_grant_detail",
					error instanceof Error ? error : new Error(String(error)),
					{ tool: "get_tango_grant_detail" }
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
