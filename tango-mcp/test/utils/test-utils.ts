/**
 * Test Utilities (OPTIONAL)
 *
 * Helpers for writing unit tests for MCP tools.
 * Use these to simplify common testing patterns.
 *
 * @module test-utils
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";

// =============================================================================
// Types
// =============================================================================

/**
 * Tool response content item
 */
export interface ToolContent {
	type: string;
	text: string;
}

/**
 * Tool response
 */
export interface ToolResponse {
	content: ToolContent[];
	isError?: boolean;
}

/**
 * Mock tool result for testing
 */
export interface MockToolResult {
	success: boolean;
	response?: ToolResponse;
	error?: Error;
}

// =============================================================================
// Mock MCP Server
// =============================================================================

/**
 * Create a mock MCP server for testing
 *
 * Returns a server instance that can be used to register and test tools.
 *
 * @returns Mock McpServer instance
 *
 * @example
 * import { describe, it, expect } from "vitest";
 * import { createMockServer } from "../utils/test-utils.js";
 * import { registerMyTool } from "../../src/tools/my-tool.js";
 *
 * describe("My Tool", () => {
 *   it("should process input correctly", async () => {
 *     const server = createMockServer();
 *     registerMyTool(server);
 *
 *     const result = await callTool(server, "my_tool", { input: "test" });
 *     expect(result.success).toBe(true);
 *   });
 * });
 */
export function createMockServer(): McpServer {
	return new McpServer({
		name: "Test Server",
		version: "0.0.0",
	});
}

// =============================================================================
// Tool Invocation Helpers
// =============================================================================

/**
 * Call a registered tool on a mock server
 *
 * Simplifies invoking tools during tests.
 *
 * @param server - MCP server instance
 * @param toolName - Name of the tool to call
 * @param params - Tool parameters
 * @returns Tool result with success flag and response/error
 *
 * @example
 * const server = createMockServer();
 * registerMyTool(server);
 *
 * const result = await callTool(server, "my_tool", { input: "test" });
 *
 * if (result.success) {
 *   expect(result.response).toBeDefined();
 *   expect(parseToolResponse(result.response)).toEqual({ output: "test" });
 * }
 */
export async function callTool(
	server: McpServer,
	toolName: string,
	params: Record<string, unknown>,
): Promise<MockToolResult> {
	try {
		// Get the tool from the server's registry
		// In SDK v1.20+, tools are stored in _registeredTools as an object
		const registeredTools = (server as any)._registeredTools || {};
		const tool = registeredTools[toolName];

		if (!tool) {
			throw new Error(`Tool "${toolName}" not found`);
		}

		// Validate parameters using the tool's input schema (if present)
		// This simulates the validation that happens in the real MCP protocol
		if (tool.inputSchema) {
			const validationResult = await tool.inputSchema.safeParseAsync(params);
			if (!validationResult.success) {
				// Format Zod validation errors nicely
				const errors = validationResult.error.errors
					.map((err) => `${err.path.join(".")}: ${err.message}`)
					.join(", ");
				throw new Error(`Validation failed: ${errors}`);
			}
			// Use the validated/coerced params
			params = validationResult.data;
		}

		// Call the tool callback (handler function)
		const response = await tool.callback(params);

		return {
			success: !response.isError,
			response,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

/**
 * Call a tool and expect success
 *
 * Throws if the tool call fails.
 *
 * @param server - MCP server instance
 * @param toolName - Name of the tool
 * @param params - Tool parameters
 * @returns Tool response
 * @throws Error if tool call fails
 *
 * @example
 * const response = await expectToolSuccess(server, "my_tool", { input: "test" });
 * expect(parseToolResponse(response)).toEqual({ output: "test" });
 */
export async function expectToolSuccess(
	server: McpServer,
	toolName: string,
	params: Record<string, unknown>,
): Promise<ToolResponse> {
	const result = await callTool(server, toolName, params);

	if (!result.success) {
		throw result.error || new Error("Tool call failed");
	}

	return result.response!;
}

/**
 * Call a tool and expect failure
 *
 * Returns the error response if tool fails as expected.
 * Throws if tool succeeds.
 *
 * @param server - MCP server instance
 * @param toolName - Name of the tool
 * @param params - Tool parameters
 * @returns Error response
 * @throws Error if tool succeeds
 *
 * @example
 * const errorResponse = await expectToolError(server, "my_tool", { invalid: true });
 * expect(parseToolResponse(errorResponse)).toMatchObject({ error: true });
 */
export async function expectToolError(
	server: McpServer,
	toolName: string,
	params: Record<string, unknown>,
): Promise<ToolResponse | Error> {
	const result = await callTool(server, toolName, params);

	if (result.success) {
		throw new Error("Expected tool to fail, but it succeeded");
	}

	return result.error || result.response!;
}

// =============================================================================
// Response Parsing Helpers
// =============================================================================

/**
 * Parse JSON from tool response
 *
 * Extracts and parses the text content from a tool response.
 *
 * @param response - Tool response
 * @returns Parsed JSON object
 *
 * @example
 * const response = await expectToolSuccess(server, "my_tool", {});
 * const data = parseToolResponse(response);
 * expect(data).toEqual({ status: "ok" });
 */
export function parseToolResponse<T = unknown>(response: ToolResponse): T {
	if (!response.content || response.content.length === 0) {
		throw new Error("Response has no content");
	}

	const text = response.content[0].text;

	try {
		return JSON.parse(text) as T;
	} catch {
		// If not JSON, return as-is
		return text as T;
	}
}

/**
 * Get raw text from tool response
 *
 * Returns the text content without parsing.
 *
 * @param response - Tool response
 * @returns Raw text content
 *
 * @example
 * const response = await expectToolSuccess(server, "echo", { message: "hi" });
 * const text = getToolResponseText(response);
 * expect(text).toBe("hi");
 */
export function getToolResponseText(response: ToolResponse): string {
	if (!response.content || response.content.length === 0) {
		return "";
	}
	return response.content[0].text;
}

/**
 * Check if response is an error
 *
 * @param response - Tool response
 * @returns true if response is an error
 *
 * @example
 * const response = await callTool(server, "my_tool", { invalid: true });
 * if (isErrorResponse(response.response)) {
 *   const error = parseToolResponse(response.response);
 *   expect(error).toHaveProperty("error");
 * }
 */
export function isErrorResponse(response?: ToolResponse): boolean {
	return response?.isError === true;
}

// =============================================================================
// Validation Testing Helpers
// =============================================================================

/**
 * Test that a Zod schema accepts valid input
 *
 * @param schema - Zod schema to test
 * @param validInput - Input that should pass validation
 *
 * @example
 * const schema = z.object({
 *   name: z.string().min(1),
 *   age: z.number().int().positive(),
 * });
 *
 * expectValidInput(schema, { name: "Alice", age: 25 });
 */
export function expectValidInput<T extends z.ZodTypeAny>(
	schema: T,
	validInput: unknown,
): void {
	const result = schema.safeParse(validInput);
	if (!result.success) {
		throw new Error(
			`Expected input to be valid, but got errors: ${JSON.stringify(result.error.errors)}`,
		);
	}
}

/**
 * Test that a Zod schema rejects invalid input
 *
 * @param schema - Zod schema to test
 * @param invalidInput - Input that should fail validation
 * @param expectedError - Optional substring to check in error message
 *
 * @example
 * const schema = z.object({
 *   email: z.string().email(),
 * });
 *
 * expectInvalidInput(schema, { email: "not-an-email" }, "Invalid email");
 */
export function expectInvalidInput<T extends z.ZodTypeAny>(
	schema: T,
	invalidInput: unknown,
	expectedError?: string,
): void {
	const result = schema.safeParse(invalidInput);
	if (result.success) {
		throw new Error("Expected input to be invalid, but validation passed");
	}

	if (expectedError) {
		const errorMessage = JSON.stringify(result.error.errors);
		if (!errorMessage.includes(expectedError)) {
			throw new Error(
				`Expected error to contain "${expectedError}", but got: ${errorMessage}`,
			);
		}
	}
}

// =============================================================================
// Mock Cloudflare Workers Environment
// =============================================================================

/**
 * Create a mock Cloudflare Workers Env
 *
 * Returns a minimal Env object for testing.
 *
 * @param overrides - Optional properties to override
 * @returns Mock Env object
 *
 * @example
 * const env = createMockEnv({
 *   MY_KV: mockKVNamespace,
 *   API_KEY: "test-key",
 * });
 */
export function createMockEnv(overrides?: Record<string, unknown>): Env {
	return {
		...overrides,
	} as Env;
}

/**
 * Create a mock ExecutionContext
 *
 * Returns a minimal ExecutionContext for testing.
 *
 * @returns Mock ExecutionContext
 *
 * @example
 * const ctx = createMockExecutionContext();
 * ctx.waitUntil(Promise.resolve());
 */
export function createMockExecutionContext(): ExecutionContext {
	const promises: Promise<unknown>[] = [];

	return {
		waitUntil: (promise: Promise<unknown>) => {
			promises.push(promise);
		},
		passThroughOnException: () => {},
	} as ExecutionContext;
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Assert that response contains expected data
 *
 * @param response - Tool response
 * @param expected - Expected data (partial match)
 *
 * @example
 * const response = await expectToolSuccess(server, "user_get", { id: "123" });
 * expectResponseContains(response, { id: "123", name: "Alice" });
 */
export function expectResponseContains(
	response: ToolResponse,
	expected: Record<string, unknown>,
): void {
	const data = parseToolResponse<Record<string, unknown>>(response);

	for (const [key, value] of Object.entries(expected)) {
		if (JSON.stringify(data[key]) !== JSON.stringify(value)) {
			throw new Error(
				`Expected response to contain ${key}: ${JSON.stringify(value)}, but got: ${JSON.stringify(data[key])}`,
			);
		}
	}
}

/**
 * Assert that response text contains substring
 *
 * @param response - Tool response
 * @param substring - Expected substring
 *
 * @example
 * const response = await expectToolSuccess(server, "echo", { message: "hello" });
 * expectResponseTextContains(response, "hello");
 */
export function expectResponseTextContains(
	response: ToolResponse,
	substring: string,
): void {
	const text = getToolResponseText(response);
	if (!text.includes(substring)) {
		throw new Error(
			`Expected response to contain "${substring}", but got: "${text}"`,
		);
	}
}

// =============================================================================
// Example Test Structure
// =============================================================================

/**
 * EXAMPLE TEST FILE STRUCTURE
 *
 * ```typescript
 * import { describe, it, expect } from "vitest";
 * import {
 *   createMockServer,
 *   expectToolSuccess,
 *   parseToolResponse,
 * } from "../utils/test-utils.js";
 * import { registerMyTool } from "../../src/tools/my-tool.js";
 *
 * describe("My Tool", () => {
 *   it("should handle valid input", async () => {
 *     const server = createMockServer();
 *     registerMyTool(server);
 *
 *     const response = await expectToolSuccess(server, "my_tool", {
 *       input: "test",
 *     });
 *
 *     const data = parseToolResponse(response);
 *     expect(data).toEqual({ output: "test" });
 *   });
 *
 *   it("should handle errors gracefully", async () => {
 *     const server = createMockServer();
 *     registerMyTool(server);
 *
 *     const response = await expectToolError(server, "my_tool", {
 *       invalid: true,
 *     });
 *
 *     expect(isErrorResponse(response)).toBe(true);
 *   });
 * });
 * ```
 */
