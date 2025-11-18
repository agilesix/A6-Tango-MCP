/**
 * Get Vendor Profile Tool
 *
 * Retrieves comprehensive entity profiles from SAM.gov data through Tango API.
 * Provides detailed vendor information including business details, contacts, and performance history.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetVendorProfileArgs } from "@/types/tool-args";
import type { Env } from "@/types/env";
import { TangoApiClient } from "@/api/tango-client";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import { normalizeVendor } from "@/utils/normalizer";
import type { CacheManager } from "@/cache/kv-cache";
import { z } from "zod";

/**
 * Register get vendor profile tool with the MCP server
 */
export function registerGetVendorProfileTool(
	server: McpServer,
	env: Env,
	cache?: CacheManager
): void {
	server.tool(
		"get_tango_vendor_profile",
		"Retrieve comprehensive entity profile from SAM.gov data through Tango's unified API. Returns detailed vendor information including legal business name, DUNS, CAGE code, registration status, business types, physical/mailing addresses, points of contact, NAICS/PSC codes, certifications, and performance summary (total contracts/grants and values). Required parameter: vendor UEI (Unique Entity Identifier). Useful for vendor due diligence, capability assessment, and contact information lookup.",
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
					"Include recent contract and grant history. Default: false. Set to true for recent awards (up to 5 most recent)."
				),
		},
		async (args) => {
			const startTime = Date.now();

			try {
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

				// Call Tango API with caching
				const client = new TangoApiClient(env, cache);
				let apiCalls = 0;

				// Get main vendor profile
				const response = await client.getVendorProfile(
					sanitized.uei,
					apiKey
				);
				apiCalls += response.cache?.hit ? 0 : 1;

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

				// Build response envelope
				const result = {
					data: normalizedVendor,
					filters: sanitized,
					execution: {
						duration_ms: Date.now() - startTime,
						cached: response.cache?.hit || false,
						api_calls: apiCalls,
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
