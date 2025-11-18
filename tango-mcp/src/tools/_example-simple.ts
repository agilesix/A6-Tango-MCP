/**
 * Example: Simple Tool
 *
 * This shows the minimal pattern for an MCP tool.
 * Copy this as a starting point for basic tools.
 *
 * Pattern:
 * 1. Import McpServer and zod
 * 2. Define parameter schema with .describe() for each field
 * 3. Export a register function that calls server.tool()
 * 4. Return content array with text (JSON.stringify for objects)
 *
 * NOTE: This is an example file - it's NOT registered by default.
 * Use it as a reference when creating your own tools.
 *
 * @example
 * To use this pattern:
 * 1. Copy this file to a new tool name
 * 2. Update the function names and descriptions
 * 3. Register it in src/index.ts
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Define parameter schema
 *
 * Each field needs:
 * - Type (z.string(), z.number(), etc.)
 * - .describe() with explanation (shown to Claude)
 * - .optional() if not required
 */
const ExampleSimpleParamsSchema = z.object({
	message: z.string().describe("Message to process"),
	uppercase: z.boolean().optional().describe("Convert to uppercase"),
});

/**
 * Register tool with MCP server
 *
 * @param server - The MCP server instance
 */
export function registerExampleSimpleTool(server: McpServer): void {
	server.tool(
		// Tool name (snake_case, used by Claude to call the tool)
		"example_simple",

		// Description (shown to Claude, be clear and concise)
		"Processes a message with optional uppercase conversion",

		// Parameter schema (the .shape gives the raw Zod object shape)
		ExampleSimpleParamsSchema.shape,

		// Handler function (async, receives validated params)
		async ({ message, uppercase }) => {
			// Simple processing logic
			const result = uppercase ? message.toUpperCase() : message;

			// Return response
			// - content array can have multiple items
			// - type can be "text", "image", or "resource"
			// - text can be plain string or JSON.stringify()
			return {
				content: [
					{
						type: "text",
						text: result,
					},
				],
			};
		},
	);
}

/**
 * ALTERNATIVE: Returning JSON data
 *
 * If you want to return structured data:
 */
export function registerExampleSimpleJsonTool(server: McpServer): void {
	server.tool(
		"example_simple_json",
		"Returns structured JSON data",
		{ input: z.string().describe("Input text") },
		async ({ input }) => {
			const data = {
				original: input,
				length: input.length,
				words: input.split(" ").length,
			};

			return {
				content: [
					{
						type: "text",
						// JSON.stringify with formatting (null, 2) makes it readable
						text: JSON.stringify(data, null, 2),
					},
				],
			};
		},
	);
}
