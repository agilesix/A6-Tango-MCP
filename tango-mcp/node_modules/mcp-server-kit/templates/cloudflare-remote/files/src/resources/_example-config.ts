/**
 * Example: Configuration Resource (DYNAMIC with ResourceTemplate)
 *
 * ⚠️  CRITICAL: This example shows a DYNAMIC resource with template variables
 *
 * URI Pattern: "config://{key}"
 * Since the URI contains {key}, we MUST use ResourceTemplate!
 *
 * 🚨 COMMON MISTAKE - DO NOT DO THIS:
 * ❌ server.resource("config", "config://{key}", ..., async (uri) => {})
 *    This will FAIL! SDK treats {key} as literal text, not a variable.
 *
 * ✅ CORRECT PATTERN:
 * ✓ server.resource("config", new ResourceTemplate("config://{key}", {...}), ..., async (uri, variables) => {})
 *    SDK extracts {key} and provides it in variables.key
 *
 * Pattern:
 * 1. Import McpServer AND ResourceTemplate
 * 2. Wrap URI pattern in new ResourceTemplate(...)
 * 3. Provide list and complete callbacks
 * 4. Handler receives (uri, variables) - NOT just (uri)
 * 5. Extract parameters from variables, NOT uri.pathname
 *
 * NOTE: This is an example file - it's NOT registered by default.
 * Use it as a reference when creating your own resources.
 *
 * @example
 * To use this pattern:
 * 1. Run: mcp-server-kit add resource config --uri-pattern "config://{key}"
 * 2. Or copy this file to a new resource name
 * 3. Update the function names and URI patterns
 * 4. Register it in src/index.ts
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Example configuration data
 *
 * In a real implementation, this might come from:
 * - Environment variables
 * - KV storage
 * - D1 database
 * - External API
 */
const CONFIG_DATA: Record<string, any> = {
	database: {
		host: "db.example.com",
		port: 5432,
		name: "myapp",
	},
	api: {
		endpoint: "https://api.example.com",
		version: "v1",
		timeout: 5000,
	},
	features: {
		authentication: true,
		caching: true,
		rateLimit: 100,
	},
};

/**
 * Register resource with MCP server
 *
 * @param server - The MCP server instance
 */
export function registerConfigResource(server: McpServer): void {
	server.resource(
		// Resource name (kebab-case, descriptive)
		"config",

		// ✅ CORRECT: URI pattern wrapped in ResourceTemplate
		// {key} is a template variable that will be extracted
		new ResourceTemplate("config://{key}", {
			// List callback - returns all available resources
			list: async () => {
				const keys = Object.keys(CONFIG_DATA);
				return {
					resources: keys.map((key) => ({
						uri: `config://${key}`,
						name: `config_${key}`,
						description: `Configuration for ${key}`,
						mimeType: "application/json",
					})),
				};
			},
			// Autocomplete callback - suggests values for {key}
			complete: {
				key: async (value) => {
					const keys = Object.keys(CONFIG_DATA);
					return keys.filter((k) => k.includes(value));
				},
			},
		}),

		// Resource metadata
		{
			description: "Access configuration values by key (database, api, features)",
			mimeType: "application/json",
		},

		// Handler function receives (uri, variables) - NOT just (uri)
		async (uri, variables) => {
			// ✅ CORRECT: Extract from variables parameter
			const key = variables.key as string;

			// Look up the configuration
			const config = CONFIG_DATA[key];

			// Handle not found
			if (!config) {
				return {
					contents: [
						{
							uri: uri.href,
							text: JSON.stringify(
								{
									error: "Configuration key not found",
									available: Object.keys(CONFIG_DATA),
								},
								null,
								2,
							),
							mimeType: "application/json",
						},
					],
				};
			}

			// Return the configuration data
			return {
				contents: [
					{
						uri: uri.href,
						text: JSON.stringify(config, null, 2),
						mimeType: "application/json",
					},
				],
			};
		},
	);
}

/**
 * ALTERNATIVE: File-like resource with different MIME types
 *
 * Resources can serve different content types:
 */
export function registerFileResource(server: McpServer): void {
	server.resource(
		"files",
		"file://{path}",
		{
			description: "Access files by path",
			mimeType: "text/plain", // Default, can be overridden per file
		},
		async (uri) => {
			const path = uri.pathname.replace("//", "");

			// Example: Serve different content types based on file extension
			if (path.endsWith(".json")) {
				return {
					contents: [
						{
							uri: uri.href,
							text: JSON.stringify({ data: "example" }, null, 2),
							mimeType: "application/json",
						},
					],
				};
			}

			if (path.endsWith(".txt")) {
				return {
					contents: [
						{
							uri: uri.href,
							text: "This is a text file",
							mimeType: "text/plain",
						},
					],
				};
			}

			if (path.endsWith(".md")) {
				return {
					contents: [
						{
							uri: uri.href,
							text: "# Markdown Example\n\nThis is a markdown file.",
							mimeType: "text/markdown",
						},
					],
				};
			}

			return {
				contents: [
					{
						uri: uri.href,
						text: "Unknown file type",
						mimeType: "text/plain",
					},
				],
			};
		},
	);
}

/**
 * ALTERNATIVE: Dynamic resource with query parameters
 *
 * Parse query parameters from the URI:
 */
export function registerQueryResource(server: McpServer): void {
	server.resource(
		"search",
		"search://{query}",
		{
			description: "Search results by query",
			mimeType: "application/json",
		},
		async (uri) => {
			// Extract path and search params
			const query = uri.pathname.replace("//", "");
			const searchParams = new URLSearchParams(uri.search);
			const limit = parseInt(searchParams.get("limit") || "10", 10);
			const offset = parseInt(searchParams.get("offset") || "0", 10);

			// Simulate search results
			const results = {
				query,
				limit,
				offset,
				results: [
					{ id: 1, title: "Result 1" },
					{ id: 2, title: "Result 2" },
				],
			};

			return {
				contents: [
					{
						uri: uri.href,
						text: JSON.stringify(results, null, 2),
						mimeType: "application/json",
					},
				],
			};
		},
	);
}

/**
 * ALTERNATIVE: List all available resources
 *
 * Useful for discovery - let Claude know what resources are available:
 */
export function registerListResource(server: McpServer): void {
	server.resource(
		"config-list",
		"config://list",
		{
			description: "List all available configuration keys",
			mimeType: "application/json",
		},
		async (uri) => {
			const availableConfigs = Object.keys(CONFIG_DATA).map((key) => ({
				key,
				uri: `config://${key}`,
				description: `Configuration for ${key}`,
			}));

			return {
				contents: [
					{
						uri: uri.href,
						text: JSON.stringify({ configs: availableConfigs }, null, 2),
						mimeType: "application/json",
					},
				],
			};
		},
	);
}

/**
 * ALTERNATIVE: Binary/Blob content
 *
 * For binary data, use blob instead of text:
 */
export function registerBinaryResource(server: McpServer): void {
	server.resource(
		"image",
		"image://{id}",
		{
			description: "Get image by ID",
			mimeType: "image/png",
		},
		async (uri) => {
			const id = uri.pathname.replace("//", "");

			// In a real implementation, fetch from R2, KV, or external storage
			// For example purposes, return a base64 encoded placeholder
			const placeholder = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

			return {
				contents: [
					{
						uri: uri.href,
						blob: placeholder, // base64 encoded binary data
						mimeType: "image/png",
					},
				],
			};
		},
	);
}

/**
 * BEST PRACTICES:
 *
 * 1. Naming: Use kebab-case for resource names (config, not config_data)
 * 2. URI Patterns: Make them intuitive (config://{key}, not cfg://{k})
 * 3. MIME Types: Use standard types (application/json, text/plain, etc.)
 * 4. Error Handling: Return helpful error messages with available options
 * 5. Listing: Consider providing a list/index resource for discovery
 * 6. Documentation: Describe what URIs are valid in the description
 * 7. Testing: Test resources return valid content structures
 *
 * Common URI Patterns:
 * - Key-value: "config://{key}"
 * - Hierarchical: "files://{path}"
 * - Query-based: "search://{query}"
 * - ID-based: "record://{id}"
 * - List: "config://list" (no parameters)
 *
 * Common Use Cases:
 * - Configuration data
 * - File system access
 * - Database records
 * - API responses
 * - Documentation
 * - Metadata
 * - Search results
 */
