/**
 * Get Forecast Detail Tool
 *
 * Retrieves detailed information for a specific forecast by forecast ID.
 * Returns comprehensive forecast data including raw source system data.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "@/types/env";
import { TangoApiClient } from "@/api/tango-client";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import type { CacheManager } from "@/cache/kv-cache";
import { getLogger } from "@/utils/logger";
import { z } from "zod";

/**
 * Register get forecast detail tool with the MCP server
 */
export function registerGetForecastDetailTool(
	server: McpServer,
	env: Env,
	cache?: CacheManager,
	userApiKey?: string
): void {
	server.tool(
		"get_forecast_detail",
		"Get detailed information for a specific federal procurement forecast by its unique forecast ID. Returns comprehensive forecast details including full description, title, agency and source system information, anticipated award date, fiscal year, NAICS industry classification code, status, set-aside information, primary contact details, place of performance, estimated contract period, contract vehicle type, complete raw data from source system, and formatted display representation. Use this when you have a forecast ID from search results and need complete forecast details. Note: Only agencies that publish forecasts to Tango will have forecast data available. Forecast IDs are integer values.",
		{
			forecast_id: z
				.union([z.number().int(), z.string()])
				.describe(
					"Forecast ID (REQUIRED). Integer value identifying the forecast. Can be provided as number or string. Example: 12345 or '12345'"
				),
		},
		async (args) => {
			const startTime = Date.now();
			const logger = getLogger();

			try {
				// Log tool invocation
				logger.toolInvocation("get_forecast_detail", args, startTime);

				// Sanitize input
				const sanitized = sanitizeToolArgs(args);

				// Validate forecast_id parameter
				if (
					!sanitized.forecast_id ||
					(typeof sanitized.forecast_id !== "string" &&
					 typeof sanitized.forecast_id !== "number")
				) {
					logger.error("Missing or invalid forecast_id parameter", undefined, {
						tool: "get_forecast_detail",
					});
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										error:
											"forecast_id parameter is required and must be an integer or integer string",
										error_code: "MISSING_PARAMETER",
										parameter: "forecast_id",
										suggestion: "Provide a forecast ID (integer)",
										example: "12345 or '12345'",
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
						tool: "get_forecast_detail",
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
					endpoint: "getForecastDetail",
					forecast_id: sanitized.forecast_id,
				});
				const client = new TangoApiClient(env, cache);
				const response = await client.getForecastDetail(
					sanitized.forecast_id,
					apiKey
				);
				logger.apiCall(
					`/forecasts/${sanitized.forecast_id}`,
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
										suggestion: "Check the forecast ID and try again",
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
					"get_forecast_detail",
					true,
					Date.now() - startTime,
					{
						forecast_id: sanitized.forecast_id,
						cached: response.cache?.hit || false,
					}
				);

				const result = {
					data: response.data,
					forecast_id: sanitized.forecast_id,
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
					"Unexpected error in get_tango_forecast_detail",
					error instanceof Error ? error : new Error(String(error)),
					{ tool: "get_forecast_detail" }
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
