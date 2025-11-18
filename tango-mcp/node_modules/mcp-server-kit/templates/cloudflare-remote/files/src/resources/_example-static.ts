/**
 * Example: Simple Resources
 *
 * Resources in MCP are data sources that servers expose to clients.
 * They can be:
 * - Static content (configuration, documentation)
 * - Dynamic data (database queries, API responses)
 * - File content (local files, remote files)
 * - Generated content (reports, summaries)
 *
 * Resources are accessed via URIs and can include metadata like MIME types.
 *
 * NOTE: This is an example file - it's NOT registered by default.
 * Use it as a reference for creating your own resources.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Example: Static Resource
 *
 * A simple resource that returns fixed content.
 * Useful for configuration, documentation, or reference data.
 */
export function registerExampleStaticResource(server: McpServer): void {
	server.resource(
		"app_config",
		"config://app/settings",
		{
			description: "Application configuration settings",
			mimeType: "application/json",
		},
		async (uri) => {
			// Return static configuration
			const config = {
				version: "1.0.0",
				environment: "production",
				features: {
					auth: true,
					analytics: true,
					debugging: false,
				},
				limits: {
					maxRequestSize: 1048576, // 1MB
					maxConnections: 100,
					rateLimit: 1000,
				},
			};

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
 * Example: Plain Text Resource
 *
 * Resources can return any text content
 */
export function registerExampleTextResource(server: McpServer): void {
	server.resource(
		"readme",
		"docs://readme",
		{
			description: "Project README documentation",
			mimeType: "text/markdown",
		},
		async (uri) => {
			const readme = `# Project Documentation

## Overview
This is an example MCP server demonstrating resource usage.

## Features
- Tools for data manipulation
- Resources for information access
- Prompts for AI assistance

## Getting Started
1. Install dependencies
2. Configure environment
3. Run the server

## API Reference
See the API documentation for details on available tools and resources.`;

			return {
				contents: [
					{
						uri: uri.href,
						text: readme,
						mimeType: "text/markdown",
					},
				],
			};
		},
	);
}

/**
 * Example: Dynamic Resource (No Parameters)
 *
 * Generate content dynamically but without URI parameters
 */
export function registerExampleDynamicResource(server: McpServer): void {
	server.resource(
		"server_status",
		"status://server",
		{
			description: "Current server status and metrics",
			mimeType: "application/json",
		},
		async (uri) => {
			// Generate dynamic status
			const status = {
				timestamp: new Date().toISOString(),
				status: "healthy",
				uptime: process.uptime ? Math.floor(process.uptime()) : 0,
				metrics: {
					requestsHandled: 1234, // In real app, track this
					activeConnections: 5,
					errorRate: 0.001,
				},
				version: "1.0.0",
			};

			return {
				contents: [
					{
						uri: uri.href,
						text: JSON.stringify(status, null, 2),
						mimeType: "application/json",
					},
				],
			};
		},
	);
}

/**
 * Example: Multiple Content Blocks
 *
 * A resource can return multiple pieces of content
 */
export function registerExampleMultiContentResource(server: McpServer): void {
	server.resource(
		"api_docs",
		"docs://api",
		{
			description: "Complete API documentation",
			mimeType: "text/markdown",
		},
		async (uri) => {
			// Return both overview and detailed docs
			return {
				contents: [
					{
						uri: `${uri.href}/overview`,
						text: "# API Overview\n\nThis API provides tools for data management and analysis.",
						mimeType: "text/markdown",
					},
					{
						uri: `${uri.href}/endpoints`,
						text: "# Endpoints\n\n## GET /data\nRetrieve data\n\n## POST /data\nCreate new data",
						mimeType: "text/markdown",
					},
					{
						uri: `${uri.href}/authentication`,
						text: "# Authentication\n\nUse Bearer tokens in the Authorization header.",
						mimeType: "text/markdown",
					},
				],
			};
		},
	);
}

/**
 * Example: Resource with Error Handling
 *
 * Always handle potential errors in resource callbacks
 */
export function registerExampleErrorHandlingResource(server: McpServer): void {
	server.resource(
		"external_data",
		"external://data",
		{
			description: "Data from external source",
			mimeType: "application/json",
		},
		async (uri) => {
			try {
				// Simulate fetching from external source
				// In real implementation, this might be a database query or API call
				const data = await fetchExternalData();

				return {
					contents: [
						{
							uri: uri.href,
							text: JSON.stringify(data, null, 2),
							mimeType: "application/json",
						},
					],
				};
			} catch (error) {
				// Throw error - the MCP server will handle it appropriately
				throw new Error(
					`Failed to fetch external data: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		},
	);
}

// Mock external data source
async function fetchExternalData(): Promise<object> {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 100));

	return {
		items: [
			{ id: 1, name: "Item 1" },
			{ id: 2, name: "Item 2" },
		],
		total: 2,
		timestamp: new Date().toISOString(),
	};
}

/**
 * Common Resource Patterns:
 *
 * 1. **Configuration Resources**
 *    - Return app settings, feature flags
 *    - Use: config://, settings://
 *
 * 2. **Documentation Resources**
 *    - Return README, API docs, help text
 *    - Use: docs://, help://
 *    - MIME type: text/markdown, text/plain
 *
 * 3. **Status Resources**
 *    - Return health checks, metrics, logs
 *    - Use: status://, metrics://, logs://
 *
 * 4. **Data Resources**
 *    - Return query results, cached data
 *    - Use: data://, cache://
 *    - MIME type: application/json
 *
 * 5. **File Resources**
 *    - Return file contents
 *    - Use: file://, content://
 *    - MIME type: based on file type
 */

/**
 * Best Practices:
 *
 * 1. **Choose Descriptive URIs**: Use clear, hierarchical URI schemes
 * 2. **Set Correct MIME Types**: Helps clients interpret content
 * 3. **Handle Errors**: Always wrap risky operations in try/catch
 * 4. **Return Appropriate Content**: Match the resource description
 * 5. **Include Metadata**: Use description and mimeType for clarity
 * 6. **Consider Caching**: For expensive operations, consider caching strategies
 */

