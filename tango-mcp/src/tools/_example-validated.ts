/**
 * Example: Complex Validation
 *
 * This shows how to use Zod for advanced parameter validation:
 * - Multiple parameter types
 * - Optional fields with defaults
 * - Enums for specific values
 * - Nested objects
 * - Custom validation rules
 *
 * NOTE: This is an example file - it's NOT registered by default.
 * Use it as a reference for complex validation scenarios.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Complex parameter schema with various validation rules
 */
const SearchParamsSchema = z.object({
	// Required string with minimum length
	query: z.string().min(1).describe("Search query (required, non-empty)"),

	// Optional number with constraints
	limit: z
		.number()
		.int()
		.positive()
		.max(100)
		.default(10)
		.describe("Maximum results (1-100, default: 10)"),

	// Enum for specific allowed values
	sort: z
		.enum(["relevance", "date", "popularity"])
		.default("relevance")
		.describe("Sort order"),

	// Optional nested object
	filters: z
		.object({
			category: z
				.enum(["news", "docs", "code", "all"])
				.optional()
				.describe("Filter by category"),
			dateFrom: z
				.string()
				.datetime()
				.optional()
				.describe("Start date (ISO 8601)"),
			dateTo: z
				.string()
				.datetime()
				.optional()
				.describe("End date (ISO 8601)"),
		})
		.optional()
		.describe("Optional filters"),

	// Boolean flag
	includeSnippets: z
		.boolean()
		.default(true)
		.describe("Include text snippets in results"),
});

/**
 * Register search tool with complex validation
 */
export function registerExampleValidatedTool(server: McpServer): void {
	server.tool(
		"example_validated",
		"Search with advanced filtering and validation",
		SearchParamsSchema.shape,
		async (params) => {
			// Zod has already validated all parameters by this point
			// - Required fields are guaranteed to exist
			// - Optional fields have default values if not provided
			// - All types match the schema
			// - All constraints (min, max, enum) are enforced

			const { query, limit, sort, filters, includeSnippets } = params;

			// Example: Build search results
			const results = {
				query,
				metadata: {
					total: 42,
					limit,
					sort,
					hasFilters: !!filters,
				},
				results: [
					{
						title: "Example Result 1",
						snippet: includeSnippets ? "This is a snippet..." : undefined,
						relevance: 0.95,
					},
					{
						title: "Example Result 2",
						snippet: includeSnippets ? "Another snippet..." : undefined,
						relevance: 0.87,
					},
				],
			};

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(results, null, 2),
					},
				],
			};
		},
	);
}

/**
 * Example: Custom validation with .refine()
 *
 * For custom validation logic beyond Zod's built-in validators
 */
// First, define the base object schema (needed for .shape property)
const DateRangeBaseSchema = z.object({
	startDate: z.string().datetime().describe("Start date"),
	endDate: z.string().datetime().describe("End date"),
});

// Then apply custom validation with .refine()
const DateRangeParamsSchema = DateRangeBaseSchema.refine(
	(data) => {
		// Custom validation: endDate must be after startDate
		return new Date(data.endDate) > new Date(data.startDate);
	},
	{
		message: "End date must be after start date",
	},
);

export function registerExampleDateRangeTool(server: McpServer): void {
	server.tool(
		"example_date_range",
		"Example with custom date validation",
		// Use base schema's .shape for tool registration
		// The MCP SDK will still validate using the refined schema
		DateRangeBaseSchema.shape,
		async ({ startDate, endDate }) => {
			const start = new Date(startDate);
			const end = new Date(endDate);
			const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

			return {
				content: [
					{
						type: "text",
						text: `Date range: ${days} days`,
					},
				],
			};
		},
	);
}

/**
 * Common Zod patterns you might need:
 *
 * // Array of strings
 * tags: z.array(z.string()).describe("Tags")
 *
 * // Optional with default
 * active: z.boolean().default(true)
 *
 * // Transform (convert string to number)
 * age: z.string().transform(Number)
 *
 * // Union types (either/or)
 * id: z.union([z.string(), z.number()])
 *
 * // Record (object with dynamic keys)
 * metadata: z.record(z.string(), z.any())
 *
 * // Regular expression
 * email: z.string().regex(/^[^@]+@[^@]+\\.[^@]+$/)
 */
