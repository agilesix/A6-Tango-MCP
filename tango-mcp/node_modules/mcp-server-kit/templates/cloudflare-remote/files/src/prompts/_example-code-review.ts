/**
 * Example: Code Review Prompt
 *
 * This shows the pattern for an MCP prompt.
 * Prompts are **user-controlled** - they provide conversation starters or templates
 * that Claude can suggest to the user.
 *
 * Pattern:
 * 1. Import McpServer and zod
 * 2. Define arguments schema with .describe() for each field
 * 3. Export a register function that calls server.prompt()
 * 4. Return messages array with role ("user" or "assistant") and content
 *
 * NOTE: This is an example file - it's NOT registered by default.
 * Use it as a reference when creating your own prompts.
 *
 * Key Differences from Tools:
 * - Tools: Model-controlled (Claude decides when to call)
 * - Prompts: User-controlled (Claude suggests, user approves)
 * - Prompts return conversation messages, not direct responses
 *
 * @see MCP Protocol: https://spec.modelcontextprotocol.io/specification/server/prompts/
 * @see SDK Reference: https://github.com/modelcontextprotocol/typescript-sdk
 * @see MCP Prompts Guide: https://modelcontextprotocol.io/docs/concepts/prompts
 *
 * Protocol Version: 2024-11-05
 * SDK: @modelcontextprotocol/sdk ^1.0.0
 *
 * IMPORTANT CONSTRAINT: Prompt arguments MUST be strings only!
 * The MCP protocol requires all prompt arguments to be strings.
 * For boolean-like options: use "true"/"false" strings
 * For numeric options: use numeric strings "42"
 * For multiple values: use comma-separated strings "option1,option2"
 *
 * @example
 * To use this pattern:
 * 1. Run: mcp-server-kit add prompt code-review
 * 2. Or copy this file to a new prompt name
 * 3. Update the function names and message templates
 * 4. Register it in src/index.ts
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Define prompt arguments schema
 *
 * Arguments allow parameterized prompts.
 * Each field needs:
 * - Type (z.string(), z.number(), etc.)
 * - .describe() with explanation (shown to user)
 * - .optional() if not required
 */
const CodeReviewArgsSchema = z.object({
	language: z.string().optional().describe("Programming language being reviewed"),
	focus: z.string().optional().describe("Specific aspect to focus on (e.g., security, performance)"),
});

/**
 * Register prompt with MCP server
 *
 * @param server - The MCP server instance
 */
export function registerCodeReviewPrompt(server: McpServer): void {
	server.prompt(
		// Prompt name (kebab-case, used by Claude to identify the prompt)
		"code-review",

		// Prompt description (shown to user)
		"Review code for best practices, potential issues, and improvements",

		// Arguments schema (Zod object with field definitions)
		CodeReviewArgsSchema.shape,

		// Handler function (async, receives validated arguments)
		async ({ language, focus }) => {
			// Extract arguments with defaults
			const lang = language || "the provided code";
			const focusArea = focus || "general code quality";

			// Build the prompt message
			// This is what will be shown to the user as a conversation starter
			const promptText = `Please review ${lang} focusing on ${focusArea}.

Specifically, analyze:
1. Code structure and organization
2. Potential bugs or edge cases
3. Performance considerations
4. Security vulnerabilities
5. Best practices and idioms
6. Suggested improvements

Provide specific examples and explanations for each point.`;

			// Return messages array
			// - Each message has a role ("user" or "assistant")
			// - Each message has content with type and text
			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: promptText,
						},
					},
				],
			};
		},
	);
}

/**
 * ALTERNATIVE: Multi-turn conversation prompt
 *
 * You can return multiple messages to simulate a conversation:
 */
export function registerMultiTurnPrompt(server: McpServer): void {
	server.prompt(
		"code-review-detailed",
		"Detailed code review with follow-up questions",
		{
			codeSnippet: z.string().optional().describe("Code to review"),
		},
		async ({ codeSnippet }) => {
			return {
				messages: [
					// Initial user message
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: "I need a thorough code review of this implementation.",
						},
					},
					// Assistant response (sets context)
					{
						role: "assistant" as const,
						content: {
							type: "text" as const,
							text: "I'll provide a comprehensive code review. Please share the code you'd like me to review.",
						},
					},
					// Follow-up user message (with code if provided)
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: codeSnippet
								? `Here's the code:\n\n\`\`\`\n${codeSnippet}\n\`\`\``
								: "I'll paste the code next.",
						},
					},
				],
			};
		},
	);
}

/**
 * ALTERNATIVE: Dynamic prompt with conditional content
 *
 * Build prompts dynamically based on arguments:
 */
export function registerDynamicPrompt(server: McpServer): void {
	server.prompt(
		"code-review-custom",
		"Customizable code review prompt",
		{
			aspects: z.string().optional().describe("Comma-separated list of aspects to review (tests, performance, security)"),
		},
		async ({ aspects }) => {
			const sections = ["Code structure and readability"];

			// Parse the aspects string
			const aspectList = aspects?.toLowerCase().split(",").map((s) => s.trim()) || [];

			if (aspectList.includes("tests")) {
				sections.push("Test coverage and quality");
			}
			if (aspectList.includes("performance")) {
				sections.push("Performance optimization opportunities");
			}
			if (aspectList.includes("security")) {
				sections.push("Security vulnerabilities and best practices");
			}

			const promptText = `Please review this code with focus on:

${sections.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Provide detailed analysis for each area.`;

			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: promptText,
						},
					},
				],
			};
		},
	);
}

/**
 * BEST PRACTICES:
 *
 * 1. Naming: Use kebab-case for prompt names (code-review, not code_review)
 * 2. Descriptions: Be clear and concise - users see these
 * 3. Arguments: Make them optional when possible, provide good defaults
 * 4. Messages: Start simple - single user message is most common
 * 5. Content: Use markdown formatting for readability
 * 6. Testing: Test prompts return valid message structures
 *
 * Common Patterns:
 * - Question prompts: Ask Claude to analyze something
 * - Template prompts: Provide structured format for responses
 * - Workflow prompts: Guide multi-step processes
 * - Domain-specific prompts: Industry-specific analysis templates
 */
