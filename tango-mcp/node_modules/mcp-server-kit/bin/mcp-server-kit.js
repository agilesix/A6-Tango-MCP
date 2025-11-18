#!/usr/bin/env node

/**
 * MCP Server Kit CLI Entry Point
 *
 * This file serves as the executable entry point for the mcp-server-kit CLI.
 * It imports and runs the CLI implementation from the compiled distribution.
 */

import("../dist/cli.js")
	.then((cli) => {
		cli.run();
	})
	.catch((error) => {
		console.error("\n❌ Failed to load CLI");
		console.error(`\nError: ${error.message}`);
		console.error('\n💡 Troubleshooting:');
		console.error('  1. Ensure mcp-server-kit is properly installed');
		console.error('  2. Try running: npm install -g mcp-server-kit');
		console.error('  3. Check that Node.js version >= 18.0.0');
		console.error('  4. If developing locally, run: npm run build');
		console.error('\nFor help: mcp-server-kit --help\n');
		process.exit(1);
	});
