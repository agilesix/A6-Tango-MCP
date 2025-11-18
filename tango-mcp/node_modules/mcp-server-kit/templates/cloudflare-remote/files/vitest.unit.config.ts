/**
 * Vitest Configuration for Unit Tests with Coverage
 *
 * Uses Node.js environment (not Workers pool) to enable V8 coverage collection.
 * For deployment validation with Workers environment, use the default vitest.config.ts
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["test/unit/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["src/**/*.ts"],
			exclude: [
				"src/**/*.d.ts",
				"src/types/**",
				"src/index.ts", // MCP server entry point (tested via integration tests)
				"src/tools/**", // MCP tools (tested via integration tests)
				"**/node_modules/**",
				"**/test/**",
			],
		},
	},
});
