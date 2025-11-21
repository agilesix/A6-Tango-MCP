/**
 * Unit Tests for Health Check Tool
 */

import { describe, it, expect, vi } from "vitest";
import { registerHealthTool } from "@/tools/health";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("Health Check Tool", () => {
	it("should register with correct name and no parameters", () => {
		const mockServer = {
			tool: vi.fn(),
		} as unknown as McpServer;

		registerHealthTool(mockServer);

		expect(mockServer.tool).toHaveBeenCalledWith(
			"health",
			expect.stringContaining("health status"),
			{}, // No parameters
			expect.any(Function)
		);
	});

	it("should return healthy status with all required fields", async () => {
		const mockServer = {
			tool: vi.fn(),
		} as unknown as McpServer;

		registerHealthTool(mockServer);

		// Get the handler function
		const handler = (mockServer.tool as any).mock.calls[0][3];
		const response = await handler({});

		expect(response.content).toHaveLength(1);
		expect(response.content[0].type).toBe("text");

		const data = JSON.parse(response.content[0].text);
		expect(data.status).toBe("healthy");
		expect(data.server).toBe("tango-mcp");
		expect(data.version).toBe("1.0.0");
		expect(data.timestamp).toBeDefined();
		expect(data.uptime).toBeDefined();
	});

	it("should return valid ISO 8601 timestamp", async () => {
		const mockServer = {
			tool: vi.fn(),
		} as unknown as McpServer;

		registerHealthTool(mockServer);

		const handler = (mockServer.tool as any).mock.calls[0][3];
		const response = await handler({});

		const data = JSON.parse(response.content[0].text);
		expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
	});

	it("should include uptime as number or N/A", async () => {
		const mockServer = {
			tool: vi.fn(),
		} as unknown as McpServer;

		registerHealthTool(mockServer);

		const handler = (mockServer.tool as any).mock.calls[0][3];
		const response = await handler({});

		const data = JSON.parse(response.content[0].text);
		expect(
			typeof data.uptime === "number" || data.uptime === "N/A"
		).toBe(true);
	});
});
