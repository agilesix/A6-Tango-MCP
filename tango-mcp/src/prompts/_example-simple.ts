/**
 * Example: Simple Prompt
 *
 * This shows how to create a basic prompt that guides an LLM's behavior.
 * Prompts are templates that help shape the model's responses by providing:
 * - System instructions
 * - Context about the task
 * - Examples of desired behavior
 * - Persona or role definitions
 *
 * NOTE: This is an example file - it's NOT registered by default.
 * Use it as a reference for creating your own prompts.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Prompt arguments must be strings only (MCP SDK limitation)
 * 
 * For boolean-like options, use:
 * - Enums: z.enum(["yes", "no"])
 * - Comma-separated strings: "option1,option2,option3"
 */
const CodeHelperArgsSchema = z.object({
	language: z
		.string()
		.optional()
		.describe("Programming language (e.g., 'typescript', 'python')"),
	style: z
		.enum(["concise", "detailed", "beginner-friendly"])
		.optional()
		.describe("Response style preference"),
});

/**
 * Register a simple code helper prompt
 *
 * This prompt guides the LLM to act as a programming assistant
 */
export function registerExampleSimplePrompt(server: McpServer): void {
	server.prompt(
		"code_helper",
		"Get coding assistance with clear explanations and examples",
		CodeHelperArgsSchema.shape,
		async (args) => {
			const language = args.language || "any language";
			const style = args.style || "detailed";

			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `You are an expert programming assistant specializing in ${language}.

Your task is to help developers write better code by:
- Providing clear, ${style} explanations
- Showing working examples
- Explaining best practices and common pitfalls
- Suggesting modern, idiomatic solutions

When answering questions:
1. Start with a direct answer
2. Explain the reasoning
3. Provide a code example if relevant
4. Mention any important caveats or alternatives

Be encouraging and supportive. Remember that developers of all skill levels may ask questions.`,
						},
					},
				],
			};
		},
	);
}

/**
 * Example: Zero-argument prompt
 *
 * Simplest form - no arguments needed
 */
export function registerExampleZeroArgPrompt(server: McpServer): void {
	server.prompt(
		"code_reviewer",
		"Get a thorough code review with best practice suggestions",
		async () => {
			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `You are a senior software engineer performing a code review.

Review the code with attention to:
- Correctness and logic errors
- Security vulnerabilities
- Performance issues
- Code readability and maintainability
- Best practices and design patterns
- Test coverage and edge cases

Provide:
1. Overall assessment (Good/Needs Improvement/Needs Major Changes)
2. Specific issues found (prioritized by severity)
3. Concrete suggestions for improvement
4. Positive feedback on what's done well

Be constructive and educational in your feedback.`,
						},
					},
				],
			};
		},
	);
}

/**
 * Example: Multi-message prompt (conversation starter)
 *
 * Use multiple messages to set up a conversation context
 */
export function registerExampleMultiMessagePrompt(server: McpServer): void {
	server.prompt(
		"pair_programmer",
		"Start a pair programming session with an AI assistant",
		async () => {
			return {
				description: "Interactive pair programming session",
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: "I'd like to start a pair programming session. Can you help me work through a coding problem?",
						},
					},
					{
						role: "assistant" as const,
						content: {
							type: "text" as const,
							text: `Absolutely! I'm here to pair program with you. Here's how we can work together:

**My Role:**
- Ask clarifying questions
- Suggest approaches and solutions
- Help debug issues
- Explain concepts and patterns
- Review your code

**Your Role:**
- Describe what you're trying to build
- Share your code or pseudocode
- Ask questions when stuck
- Give feedback on my suggestions

What are you working on today?`,
						},
					},
				],
			};
		},
	);
}

/**
 * Common Prompt Patterns:
 *
 * 1. **Role Assignment**
 *    "You are an expert [role] who [specialization]..."
 *
 * 2. **Task Definition**
 *    "Your task is to [action] by [method]..."
 *
 * 3. **Constraints**
 *    "When responding: 1) [rule], 2) [rule], 3) [rule]..."
 *
 * 4. **Output Format**
 *    "Provide: 1. [section], 2. [section], 3. [section]..."
 *
 * 5. **Examples** (few-shot learning)
 *    "Example input: ... Example output: ..."
 *
 * 6. **Tone/Style**
 *    "Be [adjective], [adjective], and [adjective]..."
 */

