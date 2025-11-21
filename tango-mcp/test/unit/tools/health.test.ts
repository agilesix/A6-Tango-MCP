/**
 * Unit Tests for Health Check Tool
 */

import { describe, it, expect } from "vitest";
import {
	createMockServer,
	expectToolSuccess,
	parseToolResponse,
} from "../../utils/test-utils";
import { registerHealthTool } from "@/tools/health";

describe("Health Check Tool", () => {
	it("should return healthy status", async () => {
		const server = createMockServer();
		registerHealthTool(server);

		const response = await expectToolSuccess(server, "health", {});
		const data = parseToolResponse<{
			status: string;
			timestamp: string;
			uptime: number | string;
			server: string;
			version: string;
		}>(response);

		expect(data.status).toBe("healthy");
		expect(data.server).toBe("tango-mcp");
		expect(data.version).toBe("1.0.0");
	});

	it("should include timestamp", async () => {
		const server = createMockServer();
		registerHealthTool(server);

		const response = await expectToolSuccess(server, "health", {});
		const data = parseToolResponse<{ timestamp: string }>(response);

		expect(data.timestamp).toBeDefined();
		// Verify it's a valid ISO 8601 timestamp
		expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
	});

	it("should include uptime information", async () => {
		const server = createMockServer();
		registerHealthTool(server);

		const response = await expectToolSuccess(server, "health", {});
		const data = parseToolResponse<{ uptime: number | string }>(response);

		expect(data.uptime).toBeDefined();
		// Uptime is either a number (seconds) or "N/A" in Workers
		expect(
			typeof data.uptime === "number" || data.uptime === "N/A",
		).toBe(true);
	});

	it("should not require any parameters", async () => {
		const server = createMockServer();
		registerHealthTool(server);

		// Should work with empty params
		const response = await expectToolSuccess(server, "health", {});
		expect(response).toBeDefined();
		expect(response.content).toHaveLength(1);
	});

	it("should return valid JSON", async () => {
		const server = createMockServer();
		registerHealthTool(server);

		const response = await expectToolSuccess(server, "health", {});

		// parseToolResponse will throw if JSON is invalid
		expect(() => parseToolResponse(response)).not.toThrow();
	});
});
