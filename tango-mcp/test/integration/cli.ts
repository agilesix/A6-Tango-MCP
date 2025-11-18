/**
 * Integration Test CLI
 *
 * Runs integration tests against a live MCP server instance using the mcp-server-kit test harness.
 *
 * IMPORTANT: Integration tests require the dev server to be running.
 *
 * Quick Start:
 *   1. Start dev server: npm run dev
 *   2. Run tests: npm run integration:run
 *
 * Or use auto-start (starts server automatically):
 *   npm run integration:run -- --auto-start
 *
 * The test runner will:
 *   - Check if dev server is running (pre-flight checks)
 *   - Optionally auto-start dev server (with --auto-start flag)
 *   - Run integration tests from test/integration/specs/
 *   - Provide detailed error messages with suggestions
 *   - Clean up auto-started server on exit
 *
 * Available Commands:
 *   run [patterns...]  Run integration tests
 *     --auto-start     Automatically start dev server if not running
 *     --json           Output results as JSON
 *     --simple         Simple output format
 *     --verbose        Verbose output with detailed logs
 *
 *   list               List available test specs
 *
 * Examples:
 *   npm run integration:run                    # Run all tests
 *   npm run integration:run -- --auto-start   # Auto-start server and run tests
 *   npm run integration:run echo.yaml         # Run specific test
 *   npm run integration:list                  # List available tests
 */

// Production: import from published package
import { TestRunner, loadTestSpec, formatAsJSON, printConsole } from "mcp-server-kit/harness";
import type { TestSpec } from "mcp-server-kit/harness";
import { createClient, DEFAULT_SERVER_URL } from "./config.js";
import { glob } from "glob";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, access } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main CLI entry point
 */
async function main() {
	const args = process.argv.slice(2);
	const command = args[0];

	if (command === "run") {
		await runTests(args.slice(1));
	} else if (command === "list") {
		await listTests();
	} else {
		console.log("Usage: tsx test/integration/cli.ts <command> [options]");
		console.log("");
		console.log("Commands:");
		console.log("  run [patterns...]  Run integration tests");
		console.log("");
		console.log("Options:");
		console.log("  --auto-start       Automatically start dev server if not running");
		console.log("  --json             Output results as JSON");
		console.log("  --simple           Simple output format");
		console.log("  --verbose          Verbose output with detailed logs");
		console.log("");
		console.log("Other Commands:");
		console.log("  list               List available tests");
		console.log("");
		console.log("Examples:");
		console.log("  npm run integration:run");
		console.log("  npm run integration:run -- --auto-start");
		console.log("  npm run integration:run echo.yaml");
		process.exit(1);
	}
}

/**
 * Run integration tests
 */
async function runTests(args: string[]) {
	// Parse flags
	const jsonOutput = args.includes("--json");
	const simpleOutput = args.includes("--simple");
	const verbose = args.includes("--verbose");
	const autoStart = args.includes("--auto-start");

	// Get patterns (everything that's not a flag)
	const patterns = args.filter((arg) => !arg.startsWith("--"));

	// Default pattern if none provided
	const defaultPattern = "**/*.yaml";
	const searchPatterns =
		patterns.length > 0 ? patterns : [defaultPattern];

	// Find test spec files
	const specsDir = join(__dirname, "specs");
	const files: string[] = [];

	for (const pattern of searchPatterns) {
		const matches = await glob(pattern, {
			cwd: specsDir,
			absolute: true,
		});
		files.push(...matches);
	}

	if (files.length === 0) {
		console.error("No test specs found");
		process.exit(1);
	}

	// Load test specs
	const specs: TestSpec[] = [];
	for (const file of files) {
		const spec = await loadTestSpec(file);
		specs.push(spec);
	}

	// Run pre-flight checks
	if (!verbose) {
		console.log("\n🔍 Running pre-flight checks...");
	}
	const preFlightResult = await runPreFlightChecks(DEFAULT_SERVER_URL, verbose);

	// Check if server is not running and auto-start is enabled
	let autoStartedProcess: ChildProcess | null = null;
	if (!preFlightResult.passed && autoStart) {
		const serverNotRunning = preFlightResult.issues.some(
			(issue) => issue.message.includes("Dev server not responding")
		);

		if (serverNotRunning) {
			console.log("\n📍 Dev server not running. Auto-starting...\n");
			try {
				autoStartedProcess = await autoStartServer(DEFAULT_SERVER_URL, verbose);
			} catch (error) {
				console.error(`\n❌ Failed to auto-start server: ${error instanceof Error ? error.message : String(error)}\n`);
				console.error("💡 Try starting manually: npm run dev\n");
				process.exit(1);
			}
		} else {
			// Non-server issues, can't auto-fix
			console.error("\n❌ Pre-flight checks failed. Fix the issues above before running integration tests.\n");
			process.exit(1);
		}
	} else if (!preFlightResult.passed) {
		console.error("\n❌ Pre-flight checks failed. Fix the issues above before running integration tests.");
		console.error("💡 Tip: Use --auto-start to automatically start the dev server\n");
		process.exit(1);
	}

	if (!verbose && !autoStartedProcess) {
		console.log("✅ Pre-flight checks passed\n");
	}

	// Register cleanup handlers for auto-started server
	if (autoStartedProcess) {
		const cleanup = () => {
			if (autoStartedProcess && !autoStartedProcess.killed) {
				if (!verbose) {
					console.log("\n🛑 Stopping auto-started dev server...");
				}
				autoStartedProcess.kill();
			}
		};

		process.on("exit", cleanup);
		process.on("SIGINT", () => {
			cleanup();
			process.exit(130);
		});
		process.on("SIGTERM", () => {
			cleanup();
			process.exit(143);
		});
	}

	// Create client and runner
	const client = createClient();
	const runner = new TestRunner(client);

	try {
		// Connect to server
		await runner.connect();

		// Run tests
		const results = await runner.runTests(specs, DEFAULT_SERVER_URL);

		// Output results
		if (jsonOutput) {
			console.log(formatAsJSON(results));
		} else if (simpleOutput) {
			if (results.summary.failed === 0) {
				console.log(`✅ All ${results.summary.passed} tests passed`);
			} else {
				console.log(`❌ ${results.summary.failed} tests failed`);
			}
		} else {
			printConsole(results);
		}

		// Disconnect
		await runner.disconnect();

		// Exit with appropriate code
		process.exit(results.summary.failed > 0 ? 2 : 0);
	} catch (error) {
		console.error("\n❌ Error running tests:\n");

		// Smart error detection - analyze and provide suggestions
		const errorAnalysis = analyzeError(error);
		if (errorAnalysis) {
			console.error(errorAnalysis.message);
			if (errorAnalysis.suggestions.length > 0) {
				console.error("\n💡 Suggested fixes:");
				for (const suggestion of errorAnalysis.suggestions) {
					console.error(`  • ${suggestion}`);
				}
			}
			if (errorAnalysis.docs) {
				console.error(`\n📚 Docs: ${errorAnalysis.docs}`);
			}
		} else {
			console.error(error);
		}

		await runner.disconnect();
		process.exit(3);
	}
}

/**
 * List available tests
 */
async function listTests() {
	const specsDir = join(__dirname, "specs");
	const files = await glob("**/*.yaml", {
		cwd: specsDir,
		absolute: false,
	});

	console.log("Available test specs:");
	for (const file of files) {
		console.log(`  - ${file}`);
	}
}

/**
 * Error analysis result
 */
interface ErrorAnalysis {
	message: string;
	suggestions: string[];
	docs?: string;
}

/**
 * Analyze common error patterns and provide helpful suggestions
 */
function analyzeError(error: unknown): ErrorAnalysis | null {
	const errorStr = error instanceof Error ? error.message : String(error);
	const errorStack = error instanceof Error ? error.stack || "" : "";
	const fullError = `${errorStr}\n${errorStack}`;

	// Pattern 1: MCP_OBJECT binding not found
	if (
		fullError.includes("Could not find McpAgent binding") ||
		fullError.includes("MCP_OBJECT")
	) {
		return {
			message: "MCP_OBJECT Durable Object binding not found",
			suggestions: [
				"Check wrangler.jsonc has 'durable_objects' configuration",
				"Run: npm run validate",
				"Restart dev server after config changes: npm run dev",
			],
			docs: "Ensure wrangler.jsonc has: durable_objects.bindings with MCP_OBJECT",
		};
	}

	// Pattern 2: Connection refused / Server not running
	if (
		fullError.includes("ECONNREFUSED") ||
		fullError.includes("fetch failed") ||
		fullError.includes("Connection refused")
	) {
		return {
			message: "Cannot connect to dev server",
			suggestions: [
				"Start dev server: npm run dev",
				"Check server is running: curl http://localhost:8788/health",
				"Verify port 8788 is not blocked by firewall",
			],
		};
	}

	// Pattern 3: Port already in use
	if (fullError.includes("EADDRINUSE") || fullError.includes("address already in use")) {
		return {
			message: "Port 8788 is already in use",
			suggestions: [
				"Kill existing process: lsof -ti :8788 | xargs kill -9",
				"Or change port in wrangler.jsonc: dev.port",
			],
		};
	}

	// Pattern 4: Types out of date
	if (
		fullError.includes("types might be out of date") ||
		fullError.includes("wrangler types")
	) {
		return {
			message: "TypeScript types are out of date",
			suggestions: [
				"Regenerate types: npm run cf-typegen",
				"Restart TypeScript server in your editor",
			],
		};
	}

	// Pattern 5: HTTP 500 from MCP endpoint
	if (fullError.includes("HTTP 500") || fullError.includes("Internal Server Error")) {
		return {
			message: "MCP server returned HTTP 500 error",
			suggestions: [
				"Check dev server logs for error details",
				"Verify wrangler.jsonc configuration: npm run validate",
				"Check src/index.ts for runtime errors",
				"Restart dev server: npm run dev",
			],
		};
	}

	// Pattern 6: Invalid JSON / Parse errors
	if (
		fullError.includes("JSON") &&
		(fullError.includes("parse") || fullError.includes("Unexpected"))
	) {
		return {
			message: "JSON parsing error",
			suggestions: [
				"Check wrangler.jsonc syntax: npm run validate",
				"Verify integration test YAML files are valid",
				"Check tool responses return valid JSON",
			],
		};
	}

	// Pattern 7: Module not found / Import errors
	if (
		fullError.includes("Cannot find module") ||
		fullError.includes("MODULE_NOT_FOUND")
	) {
		return {
			message: "Module or dependency not found",
			suggestions: [
				"Install dependencies: npm install",
				"Check import paths in src/ files",
				"Verify all tools are properly exported",
			],
		};
	}

	// Pattern 8: Permission errors
	if (fullError.includes("EACCES") || fullError.includes("permission denied")) {
		return {
			message: "Permission denied error",
			suggestions: [
				"Check file permissions: ls -la",
				"Try running with appropriate permissions",
				"Check if files are owned by correct user",
			],
		};
	}

	// No matching pattern
	return null;
}

/**
 * Auto-start the dev server
 *
 * Spawns `npm run dev` and waits for the server to be ready.
 *
 * @param serverUrl - The server URL to check for readiness
 * @param verbose - Whether to show verbose output
 * @returns The spawned child process, or null if failed
 */
async function autoStartServer(
	serverUrl: string,
	verbose: boolean
): Promise<ChildProcess> {
	const projectRoot = join(__dirname, "../..");

	// Spawn dev server
	const serverProcess = spawn("npm", ["run", "dev"], {
		cwd: projectRoot,
		stdio: verbose ? "inherit" : ["ignore", "pipe", "pipe"],
		detached: false,
		shell: true,
	});

	// Handle process errors
	serverProcess.on("error", (error) => {
		throw new Error(`Failed to spawn dev server: ${error.message}`);
	});

	// Wait for server to be ready (max 60 seconds)
	const maxWaitTime = 60;
	const checkInterval = 1000; // 1 second

	for (let i = 0; i < maxWaitTime; i++) {
		await new Promise((resolve) => setTimeout(resolve, checkInterval));

		try {
			const healthUrl = new URL("/health", serverUrl);
			const response = await fetch(healthUrl.toString(), {
				signal: AbortSignal.timeout(2000),
			});

			if (response.ok) {
				const data = await response.json();
				if (data.status === "ok") {
					if (!verbose) {
						console.log(`✅ Dev server started successfully (took ${i + 1}s)\n`);
					}
					return serverProcess;
				}
			}
		} catch {
			// Server not ready yet, continue waiting
		}

		// Check if process died
		if (serverProcess.killed || serverProcess.exitCode !== null) {
			throw new Error("Dev server process died during startup");
		}
	}

	// Timeout - kill the process and throw
	serverProcess.kill();
	throw new Error(`Dev server failed to start after ${maxWaitTime} seconds`);
}

/**
 * Pre-flight check result
 */
interface PreFlightCheckResult {
	passed: boolean;
	issues: Array<{
		type: "error" | "warning";
		message: string;
		suggestion?: string;
	}>;
}

/**
 * Run pre-flight checks before integration tests
 */
async function runPreFlightChecks(
	serverUrl: string,
	verbose: boolean
): Promise<PreFlightCheckResult> {
	const issues: PreFlightCheckResult["issues"] = [];

	// Check 1: Dev server responding
	if (verbose) {
		console.log("  Checking dev server...");
	}
	try {
		const healthUrl = new URL("/health", serverUrl);
		const response = await fetch(healthUrl.toString(), {
			signal: AbortSignal.timeout(5000),
		});

		if (!response.ok) {
			issues.push({
				type: "error",
				message: `Dev server responded with HTTP ${response.status}`,
				suggestion: `Check server logs and ensure it's running correctly`,
			});
		} else {
			const data = await response.json();
			if (data.status !== "ok") {
				issues.push({
					type: "warning",
					message: `Health check returned unexpected status: ${JSON.stringify(data)}`,
				});
			}
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		issues.push({
			type: "error",
			message: `Dev server not responding at ${serverUrl}`,
			suggestion: errorMsg.includes("ECONNREFUSED")
				? `Start dev server: npm run dev`
				: `Check server URL and ensure it's running: ${errorMsg}`,
		});
	}

	// Check 2: wrangler.jsonc configuration
	if (verbose) {
		console.log("  Checking wrangler.jsonc configuration...");
	}
	const projectRoot = join(__dirname, "../..");
	const wranglerPath = join(projectRoot, "wrangler.jsonc");

	try {
		await access(wranglerPath);
		const content = await readFile(wranglerPath, "utf-8");

		// Parse JSONC (improved comment removal that preserves strings)
		// Remove single-line comments (but not // inside strings)
		// This is a simplified approach - only remove comments at line start or after whitespace
		const jsonContent = content
			.replace(/\/\*[\s\S]*?\*\//g, "") // Remove multi-line comments
			.split('\n')
			.map(line => {
				// Only remove // comments if they appear outside of quoted strings
				// Simple heuristic: if line has quotes before //, it's likely in a string
				const commentIndex = line.indexOf('//');
				if (commentIndex === -1) return line;

				// Count quotes before comment
				const beforeComment = line.substring(0, commentIndex);
				const quoteCount = (beforeComment.match(/"/g) || []).length;

				// If odd number of quotes, // is inside a string, keep the line
				if (quoteCount % 2 !== 0) return line;

				// Even quotes (or no quotes), safe to remove comment
				return line.substring(0, commentIndex);
			})
			.join('\n');
		const config = JSON.parse(jsonContent);

		// Check for required fields
		if (!config.durable_objects) {
			issues.push({
				type: "error",
				message: "wrangler.jsonc missing 'durable_objects' configuration",
				suggestion: "Run: npm run validate",
			});
		} else {
			const bindings = config.durable_objects.bindings;
			if (!bindings || !Array.isArray(bindings)) {
				issues.push({
					type: "error",
					message: "wrangler.jsonc 'durable_objects.bindings' must be an array",
					suggestion: "Run: npm run validate",
				});
			} else {
				const mcpBinding = bindings.find((b: Record<string, unknown>) => b.name === "MCP_OBJECT");
				if (!mcpBinding) {
					issues.push({
						type: "error",
						message: "wrangler.jsonc missing MCP_OBJECT binding",
						suggestion: "Run: npm run validate",
					});
				}
			}
		}

		if (!config.migrations || !Array.isArray(config.migrations) || config.migrations.length === 0) {
			issues.push({
				type: "error",
				message: "wrangler.jsonc missing 'migrations' configuration",
				suggestion: "Run: npm run validate",
			});
		}

		// Check for deprecated field
		if (config.mcp) {
			issues.push({
				type: "error",
				message: "wrangler.jsonc has deprecated 'mcp' field",
				suggestion: "Remove 'mcp' field and use 'durable_objects' instead. Run: npm run validate",
			});
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			issues.push({
				type: "error",
				message: "wrangler.jsonc not found",
				suggestion: "Ensure you're running from the project root",
			});
		} else {
			issues.push({
				type: "error",
				message: `Error reading wrangler.jsonc: ${error instanceof Error ? error.message : String(error)}`,
				suggestion: "Run: npm run validate",
			});
		}
	}

	// Check 3: src/index.ts exists
	if (verbose) {
		console.log("  Checking src/index.ts...");
	}
	const indexPath = join(projectRoot, "src", "index.ts");
	try {
		await access(indexPath);
	} catch {
		issues.push({
			type: "error",
			message: "src/index.ts not found",
			suggestion: "Ensure project structure is correct",
		});
	}

	// Print issues
	if (issues.length > 0) {
		console.log("\n❌ Pre-flight check issues:\n");
		for (const issue of issues) {
			const icon = issue.type === "error" ? "  ❌" : "  ⚠️";
			console.log(`${icon} ${issue.message}`);
			if (issue.suggestion) {
				console.log(`     → Fix: ${issue.suggestion}`);
			}
		}
	}

	const hasErrors = issues.some((i) => i.type === "error");
	return {
		passed: !hasErrors,
		issues,
	};
}

// Run main
main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(3);
});
