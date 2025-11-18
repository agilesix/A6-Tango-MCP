/**
 * Example: Advanced Prompt Patterns
 *
 * This shows advanced prompt engineering techniques:
 * - Dynamic content generation based on parameters
 * - Structured output formatting
 * - Few-shot examples
 * - Chain-of-thought prompting
 * - Context-aware prompts
 *
 * NOTE: This is an example file - it's NOT registered by default.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Example: Structured output prompt
 *
 * Guide the model to produce consistently formatted output
 */
const ApiDocArgsSchema = z.object({
	endpoint: z.string().describe("API endpoint path (e.g., '/users/:id')"),
	method: z.string().optional().describe("HTTP method (GET, POST, etc.)"),
});

export function registerExampleStructuredPrompt(server: McpServer): void {
	server.prompt(
		"api_doc_generator",
		"Generate comprehensive API documentation",
		ApiDocArgsSchema.shape,
		async (args) => {
			const method = args.method || "GET";

			return {
				description: `Generate documentation for ${method} ${args.endpoint}`,
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `Generate API documentation for the endpoint: ${method} ${args.endpoint}

Use this exact structure:

## ${method} ${args.endpoint}

### Description
[Clear, one-sentence description]

### Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| [param] | [type] | Yes/No | [description] |

### Request Example
\`\`\`json
{
  "field": "value"
}
\`\`\`

### Response Example
\`\`\`json
{
  "success": true,
  "data": {}
}
\`\`\`

### Status Codes
- 200: Success - [description]
- 400: Bad Request - [description]
- 401: Unauthorized - [description]
- 404: Not Found - [description]

### Error Handling
[Describe error scenarios]

### Notes
- [Important implementation details]
- [Rate limits, if applicable]
- [Authentication requirements]`,
						},
					},
				],
			};
		},
	);
}

/**
 * Example: Few-shot prompt
 *
 * Include examples to guide the model's output format
 */
const TestGenArgsSchema = z.object({
	functionName: z.string().describe("Name of the function to test"),
	language: z.string().optional().describe("Programming language"),
});

export function registerExampleFewShotPrompt(server: McpServer): void {
	server.prompt(
		"test_generator",
		"Generate comprehensive unit tests for a function",
		TestGenArgsSchema.shape,
		async (args) => {
			const language = args.language || "typescript";

			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `Generate comprehensive unit tests for the function: ${args.functionName}

Language: ${language}

Follow this pattern (example for a 'sum' function):

\`\`\`${language}
describe('sum', () => {
  it('should add two positive numbers', () => {
    expect(sum(2, 3)).toBe(5);
  });

  it('should handle negative numbers', () => {
    expect(sum(-2, 3)).toBe(1);
    expect(sum(-2, -3)).toBe(-5);
  });

  it('should handle zero', () => {
    expect(sum(0, 5)).toBe(5);
    expect(sum(0, 0)).toBe(0);
  });

  it('should handle decimal numbers', () => {
    expect(sum(1.5, 2.5)).toBe(4);
  });

  it('should handle large numbers', () => {
    expect(sum(1000000, 2000000)).toBe(3000000);
  });
});
\`\`\`

Generate tests that cover:
1. Happy path (expected inputs)
2. Edge cases (boundary values)
3. Invalid inputs (error handling)
4. Special values (null, undefined, zero, etc.)
5. Type variations (if applicable)

Now generate tests for: ${args.functionName}`,
						},
					},
				],
			};
		},
	);
}

/**
 * Example: Chain-of-thought prompt
 *
 * Encourage step-by-step reasoning for complex tasks
 */
const DebugArgsSchema = z.object({
	errorMessage: z.string().describe("The error message to debug"),
	context: z.string().optional().describe("Additional context about when the error occurs"),
});

export function registerExampleChainOfThoughtPrompt(server: McpServer): void {
	server.prompt(
		"debug_helper",
		"Get step-by-step debugging guidance",
		DebugArgsSchema.shape,
		async (args) => {
			const context = args.context || "No additional context provided";

			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `Help debug this error using step-by-step analysis:

**Error Message:** ${args.errorMessage}

**Context:** ${context}

Use this debugging approach:

### Step 1: Understand the Error
- What type of error is this?
- What does the error message tell us?
- When does this error typically occur?

### Step 2: Identify Possible Causes
- List 3-5 most likely causes
- Rank them by probability

### Step 3: Gather More Information
- What additional information would help?
- What should we log or inspect?
- Are there any stack traces or error codes?

### Step 4: Propose Solutions
For each likely cause:
- Explain the fix
- Show code changes needed
- Mention any side effects

### Step 5: Prevention
- How can we prevent this error in the future?
- Should we add validation, tests, or better error handling?

Walk me through each step systematically.`,
						},
					},
				],
			};
		},
	);
}

/**
 * Example: Context-aware prompt
 *
 * Adapt the prompt based on user-provided parameters
 */
const ExplainArgsSchema = z.object({
	topic: z.string().describe("The programming concept to explain"),
	level: z
		.enum(["beginner", "intermediate", "advanced"])
		.optional()
		.describe("Explanation depth"),
	includeExamples: z
		.enum(["yes", "no"])
		.optional()
		.describe("Whether to include code examples"),
});

export function registerExampleContextAwarePrompt(server: McpServer): void {
	server.prompt(
		"concept_explainer",
		"Explain programming concepts at the right level",
		ExplainArgsSchema.shape,
		async (args) => {
			const level = args.level || "intermediate";
			const includeExamples = args.includeExamples !== "no";

			// Adapt the prompt based on the level
			const levelGuidance: Record<string, string> = {
				beginner: `Use simple language and analogies. Avoid jargon. Build from basics. 
Include real-world analogies to make concepts relatable.`,
				intermediate: `Assume familiarity with programming basics. Use technical terms but explain them. 
Focus on practical applications and common patterns.`,
				advanced: `Use precise technical language. Discuss trade-offs, performance implications, and edge cases. 
Reference relevant design patterns and architectural considerations.`,
			};

			const exampleGuidance = includeExamples
				? "\n\nInclude 2-3 code examples that demonstrate the concept in practice."
				: "\n\nFocus on conceptual explanation without code examples.";

			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `Explain the programming concept: "${args.topic}"

**Audience Level:** ${level}

**Guidance:**
${levelGuidance[level]}${exampleGuidance}

**Structure your explanation as:**

1. **What is it?**
   - Clear definition
   - Core purpose

2. **Why does it matter?**
   - Problems it solves
   - Benefits of using it

3. **How does it work?**
   - Key mechanisms
   - Important details${
						includeExamples
							? `

4. **Examples**
   - Practical code examples
   - Common use cases`
							: ""
					}

5. **Common Pitfalls**
   - What to watch out for
   - Best practices

Make your explanation clear, accurate, and appropriate for a ${level} developer.`,
						},
					},
				],
			};
		},
	);
}

/**
 * Best Practices for Prompts:
 *
 * 1. **Be Specific**: Clear instructions produce better results
 * 2. **Use Structure**: Templates and formatting guide the output
 * 3. **Provide Examples**: Few-shot learning improves consistency
 * 4. **Set Constraints**: Define what to include and exclude
 * 5. **Define Format**: Specify exactly how output should look
 * 6. **Consider Context**: Adapt prompts based on parameters
 * 7. **Test Variations**: Try different phrasings to find what works best
 * 8. **Iterate**: Refine prompts based on actual outputs
 */

