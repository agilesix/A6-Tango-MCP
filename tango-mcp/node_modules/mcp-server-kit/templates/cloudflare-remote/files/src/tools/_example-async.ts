/**
 * Example: Async Operations & Error Handling
 *
 * This shows how to:
 * - Make async API calls (fetch, database, etc.)
 * - Handle errors gracefully
 * - Use try/catch properly
 * - Return error responses
 * - Use optional utility helpers
 *
 * NOTE: This is an example file - it's NOT registered by default.
 * Use it as a reference for async operations.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const FetchParamsSchema = z.object({
	url: z.string().url().describe("URL to fetch"),
	method: z
		.enum(["GET", "POST", "PUT", "DELETE"])
		.default("GET")
		.describe("HTTP method"),
});

/**
 * Example: Async fetch with error handling
 */
export function registerExampleAsyncTool(server: McpServer): void {
	server.tool(
		"example_async",
		"Fetch data from a URL with error handling",
		FetchParamsSchema.shape,
		async ({ url, method }) => {
			try {
				// Make async API call
				const response = await fetch(url, {
					method,
					headers: {
						"Content-Type": "application/json",
					},
				});

				// Check for HTTP errors
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				// Parse response
				const data = await response.json();

				// Return success response
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									status: response.status,
									data,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				// Handle errors gracefully
				const errorMessage = error instanceof Error ? error.message : String(error);

				// Return error as structured data
				// NOTE: Don't throw - return an error response instead
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: false,
									error: errorMessage,
									url,
								},
								null,
								2,
							),
						},
					],
					isError: true, // Mark as error (optional)
				};
			}
		},
	);
}

/**
 * Example: Multiple async operations (parallel)
 */
export function registerExampleParallelTool(server: McpServer): void {
	server.tool(
		"example_parallel",
		"Fetch multiple URLs in parallel",
		{
			urls: z
				.array(z.string().url())
				.min(1)
				.max(5)
				.describe("URLs to fetch (max 5)"),
		},
		async ({ urls }) => {
			try {
				// Execute multiple async operations in parallel
				const results = await Promise.allSettled(
					urls.map(async (url) => {
						const response = await fetch(url);
						return {
							url,
							status: response.status,
							ok: response.ok,
						};
					}),
				);

				// Process results
				const successCount = results.filter((r) => r.status === "fulfilled").length;
				const failureCount = results.length - successCount;

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									total: urls.length,
									success: successCount,
									failed: failureCount,
									results: results.map((r, i) => ({
										url: urls[i],
										status: r.status,
										...(r.status === "fulfilled"
											? { result: r.value }
											: { error: r.reason.message }),
									})),
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: false,
									error:
										error instanceof Error
											? error.message
											: "Unknown error",
								},
								null,
								2,
							),
						},
					],
					isError: true,
				};
			}
		},
	);
}

/**
 * Error Handling Best Practices:
 *
 * 1. Always use try/catch for async operations
 * 2. Return error responses, don't throw
 * 3. Include context in error messages
 * 4. Use structured error objects (JSON)
 * 5. Mark errors with isError: true (optional but helpful)
 * 6. Log errors for debugging (console.error in development)
 * 7. Consider retry logic for transient failures
 * 8. Set timeouts for external calls
 */

/**
 * Example: Timeout handling
 */
export function registerExampleTimeoutTool(server: McpServer): void {
	server.tool(
		"example_timeout",
		"Fetch with timeout",
		{
			url: z.string().url(),
			timeoutMs: z.number().int().positive().default(5000),
		},
		async ({ url, timeoutMs }) => {
			try {
				// Create timeout promise
				const timeoutPromise = new Promise((_, reject) => {
					setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
				});

				// Race between fetch and timeout
				const response = (await Promise.race([
					fetch(url),
					timeoutPromise,
				])) as Response;

				const data = await response.json();

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(data, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									error:
										error instanceof Error
											? error.message
											: "Unknown error",
									url,
								},
								null,
								2,
							),
						},
					],
					isError: true,
				};
			}
		},
	);
}
