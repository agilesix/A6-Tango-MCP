/**
 * Example: Dynamic Resources with URI Parameters
 *
 * Resources can use URI templates to accept parameters.
 * This enables dynamic, parameterized resources like:
 * - User profiles: user://{userId}
 * - File access: file://{path}
 * - Database records: db://{table}/{id}
 *
 * URI templates use {variable} syntax and the ResourceTemplate class.
 *
 * NOTE: This is an example file - it's NOT registered by default.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Example: Single Parameter Resource
 *
 * Access resources by ID using URI template syntax
 */
export function registerExampleParameterizedResource(server: McpServer): void {
	server.resource(
		"user_profile",
		new ResourceTemplate("user://{userId}", {
			// List callback returns all available resources of this type
			list: async () => {
				// In a real app, this would query your database
				const users = [
					{ id: "1", name: "Alice" },
					{ id: "2", name: "Bob" },
					{ id: "3", name: "Charlie" },
				];

				return {
					resources: users.map((user) => ({
						uri: `user://${user.id}`,
						name: `user_${user.id}`,
						description: `Profile for user ${user.name}`,
						mimeType: "application/json",
					})),
				};
			},
			// Complete callback helps with autocompletion
			complete: {
				userId: async (value) => {
					// Return suggestions for userId based on partial input
					const allUserIds = ["1", "2", "3"];
					return allUserIds.filter((id) => id.includes(value));
				},
			},
		}),
		{
			description: "User profile data",
			mimeType: "application/json",
		},
		async (uri, variables) => {
			// Extract the userId from URI template variables
			const userId = variables.userId as string;

			// Fetch user data (mock implementation)
			const user = await fetchUser(userId);

			if (!user) {
				throw new Error(`User ${userId} not found`);
			}

			return {
				contents: [
					{
						uri: uri.href,
						text: JSON.stringify(user, null, 2),
						mimeType: "application/json",
					},
				],
			};
		},
	);
}

/**
 * Example: Multiple Parameters Resource
 *
 * Use multiple parameters in the URI template
 */
export function registerExampleMultiParameterResource(server: McpServer): void {
	server.resource(
		"database_record",
		new ResourceTemplate("db://{table}/{id}", {
			list: async () => {
				// Return all available database records
				const tables = ["users", "posts", "comments"];
				const resources = [];

				for (const table of tables) {
					// In real app, query each table
					const mockIds = ["1", "2", "3"];
					for (const id of mockIds) {
						resources.push({
							uri: `db://${table}/${id}`,
							name: `${table}_${id}`,
							description: `Record ${id} from ${table} table`,
							mimeType: "application/json",
						});
					}
				}

				return { resources };
			},
			complete: {
				table: async (value) => {
					const tables = ["users", "posts", "comments", "settings"];
					return tables.filter((t) => t.includes(value));
				},
				id: async (value, context) => {
					// Autocomplete depends on the table
					const table = context?.arguments?.table;
					if (!table) return [];

					// In real app, query the specific table
					const mockIds = ["1", "2", "3", "4", "5"];
					return mockIds.filter((id) => id.includes(value));
				},
			},
		}),
		{
			description: "Access database records by table and ID",
			mimeType: "application/json",
		},
		async (uri, variables) => {
			const table = variables.table as string;
			const id = variables.id as string;

			// Fetch from database (mock implementation)
			const record = await fetchDatabaseRecord(table, id);

			return {
				contents: [
					{
						uri: uri.href,
						text: JSON.stringify(
							{
								table,
								id,
								data: record,
							},
							null,
							2,
						),
						mimeType: "application/json",
					},
				],
			};
		},
	);
}

/**
 * Example: File Path Resource
 *
 * Access files using path-like URI templates
 */
export function registerExampleFileResource(server: McpServer): void {
	server.resource(
		"project_file",
		new ResourceTemplate("file:///{path}", {
			list: async () => {
				// List all available files
				const files = [
					"README.md",
					"package.json",
					"src/index.ts",
					"src/config.ts",
					"docs/api.md",
				];

				return {
					resources: files.map((path) => ({
						uri: `file:///${path}`,
						name: path,
						description: `File: ${path}`,
						mimeType: getMimeType(path),
					})),
				};
			},
			complete: {
				path: async (value) => {
					const allPaths = [
						"README.md",
						"package.json",
						"src/index.ts",
						"src/config.ts",
						"docs/api.md",
					];
					return allPaths.filter((p) => p.includes(value));
				},
			},
		}),
		{
			description: "Access project files by path",
			mimeType: "text/plain",
		},
		async (uri, variables) => {
			const path = variables.path as string;

			// Read file content (mock implementation)
			const content = await readFileContent(path);

			return {
				contents: [
					{
						uri: uri.href,
						text: content,
						mimeType: getMimeType(path),
					},
				],
			};
		},
	);
}

/**
 * Example: Hierarchical Resource
 *
 * Create nested resource structures
 */
export function registerExampleHierarchicalResource(server: McpServer): void {
	server.resource(
		"logs",
		new ResourceTemplate("logs://{date}/{level}", {
			list: async () => {
				const dates = ["2025-10-01", "2025-10-02", "2025-10-03"];
				const levels = ["error", "warning", "info"];
				const resources = [];

				for (const date of dates) {
					for (const level of levels) {
						resources.push({
							uri: `logs://${date}/${level}`,
							name: `logs_${date}_${level}`,
							description: `${level} logs for ${date}`,
							mimeType: "text/plain",
						});
					}
				}

				return { resources };
			},
			complete: {
				date: async (value) => {
					// Suggest dates
					const dates = ["2025-10-01", "2025-10-02", "2025-10-03"];
					return dates.filter((d) => d.includes(value));
				},
				level: async (value) => {
					const levels = ["error", "warning", "info", "debug"];
					return levels.filter((l) => l.includes(value));
				},
			},
		}),
		{
			description: "Access logs by date and level",
			mimeType: "text/plain",
		},
		async (uri, variables) => {
			const date = variables.date as string;
			const level = variables.level as string;

			// Fetch logs (mock implementation)
			const logs = await fetchLogs(date, level);

			return {
				contents: [
					{
						uri: uri.href,
						text: logs,
						mimeType: "text/plain",
					},
				],
			};
		},
	);
}

// Mock data fetching functions
async function fetchUser(userId: string): Promise<object | null> {
	const users: Record<string, object> = {
		"1": { id: "1", name: "Alice", email: "alice@example.com", role: "admin" },
		"2": { id: "2", name: "Bob", email: "bob@example.com", role: "user" },
		"3": {
			id: "3",
			name: "Charlie",
			email: "charlie@example.com",
			role: "user",
		},
	};
	return users[userId] || null;
}

async function fetchDatabaseRecord(
	table: string,
	id: string,
): Promise<object> {
	return {
		id,
		createdAt: new Date().toISOString(),
		data: { table, recordId: id },
	};
}

async function readFileContent(path: string): Promise<string> {
	const mockFiles: Record<string, string> = {
		"README.md": "# Project\n\nThis is a mock README file.",
		"package.json": JSON.stringify({ name: "example", version: "1.0.0" }, null, 2),
		"src/index.ts": "export function main() {\n  console.log('Hello');\n}",
	};
	return mockFiles[path] || `Mock content for ${path}`;
}

async function fetchLogs(date: string, level: string): Promise<string> {
	return `[${date}] [${level.toUpperCase()}] Sample log entry 1
[${date}] [${level.toUpperCase()}] Sample log entry 2
[${date}] [${level.toUpperCase()}] Sample log entry 3`;
}

function getMimeType(path: string): string {
	if (path.endsWith(".json")) return "application/json";
	if (path.endsWith(".md")) return "text/markdown";
	if (path.endsWith(".ts") || path.endsWith(".js")) return "text/typescript";
	return "text/plain";
}

/**
 * Key Concepts for Dynamic Resources:
 *
 * 1. **URI Templates**:
 *    - Use {variable} syntax for parameters
 *    - Can have multiple parameters
 *    - Variables are passed to your callback
 *
 * 2. **ResourceTemplate Class**:
 *    - First arg: URI template string
 *    - Second arg: config object with:
 *      - list: callback to list all resources (optional)
 *      - complete: object with autocomplete callbacks per variable (optional)
 *
 * 3. **List Callback**:
 *    - Returns array of available resources
 *    - Helps clients discover what resources exist
 *    - Should be fast (consider caching)
 *
 * 4. **Complete Callbacks**:
 *    - One callback per URI template variable
 *    - Receives partial value and context
 *    - Returns array of suggestions
 *    - Improves UX with autocomplete
 *
 * 5. **Variables Object**:
 *    - Contains extracted URI parameters
 *    - Access as: variables.paramName
 *    - Type assertion needed: `as string`
 */

/**
 * Best Practices:
 *
 * 1. **Validate Parameters**: Always validate extracted variables
 * 2. **Handle Not Found**: Throw clear errors for missing resources
 * 3. **Implement List**: Helps clients discover resources
 * 4. **Add Autocomplete**: Improves user experience
 * 5. **Use Clear URIs**: Make URI patterns intuitive
 * 6. **Consider Performance**: List operations should be fast
 * 7. **Cache When Possible**: Avoid repeated expensive operations
 */

