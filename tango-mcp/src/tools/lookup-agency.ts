/**
 * Lookup Agency Tool
 *
 * Searches federal agencies by name, abbreviation, or code to help users find
 * correct agency codes for API searches. Solves the common problem of not knowing
 * whether to use "VA" vs "Department of Veterans Affairs" vs "3600".
 *
 * Enhancement: Includes forecast availability data to help agents identify which
 * agencies publish procurement forecasts to Tango. This enables strategic planning
 * by surfacing agencies with predictive opportunities.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TangoApiClient } from "@/api/tango-client";
import type { CacheManager } from "@/cache/kv-cache";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import type { Env } from "@/types/env";
import { getLogger } from "@/utils/logger";
import { createAgencyForecastDiscoveryService } from "@/services/agency-forecast-discovery";

/**
 * Register lookup agency tool with the MCP server
 */
export function registerLookupAgencyTool(
	server: McpServer,
	env: Env,
	cache?: CacheManager,
	userApiKey?: string,
): void {
	server.tool(
		"lookup_tango_agency",
		"Search federal agencies by name, abbreviation, or code to find correct agency identifiers for Tango API searches. This tool helps resolve ambiguity when users refer to agencies by common names (e.g., 'VA', 'Veterans Affairs', 'Department of Veterans Affairs') and need the official agency code. Returns agency code, full name, abbreviation, parent department, and forecast availability. The 'has_forecasts' field indicates whether the agency actively publishes procurement forecasts to Tango (data refreshed every 24 hours). Useful for: finding correct agency codes before searching contracts/forecasts, identifying agencies with predictive opportunities, discovering sub-agencies within departments, confirming agency names and acronyms, exploring the full list of federal agencies. The /api/agencies/ endpoint is public and does not require authentication. Maximum 100 results per request.",
		{
			query: z
				.string()
				.min(1)
				.describe(
					"Search term to match against agency names, abbreviations, and codes. Searches across all three fields. Examples: 'Veterans', 'HHS', 'Defense', 'DOD', '7000'. Supports OR logic with pipe separator (e.g., 'HHS|DOD').",
				),
			limit: z
				.number()
				.int()
				.min(1)
				.max(100)
				.default(10)
				.optional()
				.describe(
					"Maximum number of agencies to return. Default: 10, Maximum: 100. Use smaller values for faster responses.",
				),
		},
		async (args) => {
			const startTime = Date.now();
			const logger = getLogger();

			try {
				logger.toolInvocation("lookup_tango_agency", args, startTime);

				// Sanitize input
				const sanitized = sanitizeToolArgs(args);

				// Note: /api/agencies/ is public and doesn't require API key
				// But we still pass it if available for consistency
				const apiKey = userApiKey || env.TANGO_API_KEY || "public";

				// Build API parameters
				const params: Record<string, unknown> = {
					search: sanitized.query,
					limit: sanitized.limit || 10,
				};

				// Call Tango API with caching
				const client = new TangoApiClient(env, cache);

				// Create forecast discovery service
				const discoveryService = createAgencyForecastDiscoveryService(client, cache);

				// Get forecast availability data in parallel with agency search
				const [response, forecastDiscovery] = await Promise.all([
					client.searchAgencies(params, apiKey),
					discoveryService.discoverAgencies(apiKey),
				]);

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
										suggestion: "Check your search term and try again",
										recoverable: true,
										transient:
											response.status === 429 || response.status === 503,
									},
									null,
									2,
								),
							},
						],
					};
				}

				// Normalize results and enhance with forecast availability
				const agencies = (response.data.results || []).map((agency) => ({
					code: agency.code || null,
					name: agency.name || null,
					abbreviation: agency.abbreviation || null,
					department: agency.department
						? {
								name: agency.department.name || null,
								code: agency.department.code || null,
						  }
						: null,
					has_forecasts: agency.code
						? forecastDiscovery.agencies.get(agency.code) ?? false
						: false,
				}));

				// Build response envelope
				logger.toolComplete(
					"lookup_tango_agency",
					true,
					Date.now() - startTime,
					{
						returned: agencies.length,
						total: response.data.total || response.data.count,
					},
				);

				const result = {
					data: agencies,
					total:
						response.data.total ||
						response.data.count ||
						agencies.length,
					returned: agencies.length,
					query: sanitized.query,
					pagination: {
						limit: sanitized.limit || 10,
						has_more: agencies.length >= (sanitized.limit || 10) &&
							agencies.length < (response.data.total || response.data.count || 0),
					},
					execution: {
						duration_ms: Date.now() - startTime,
						cached: response.cache?.hit || false,
						api_calls: 1,
						forecast_discovery_cached: forecastDiscovery.cached,
						forecast_discovery_sampled: forecastDiscovery.sampled,
						agencies_with_forecasts: forecastDiscovery.agencies.size,
						forecast_discovery_error: forecastDiscovery.error,
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
					"Unexpected error in lookup_tango_agency",
					error instanceof Error ? error : new Error(String(error)),
					{ tool: "lookup_tango_agency" }
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
								2,
							),
						},
					],
				};
			}
		},
	);
}
