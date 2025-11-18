/**
 * Echo Tool
 *
 * Echoes back the provided message (useful for testing).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Register echo tool with the MCP server
 */
export function registerEchoTool(server: McpServer): void {
	server.tool(
		"echo",
		"Echoes back the provided message",
		{
			message: z.string().describe("The message to echo back"),
		},
		async ({ message }) => {
			return {
				content: [
					{
						type: "text",
						text: `Echo: ${message}`,
					},
				],
			};
		},
	);
}
