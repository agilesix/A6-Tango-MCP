import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetCompanyIntelligenceTool } from "@/tools/get-company-intelligence";
import type { Env } from "@/types/env";

describe("get_tango_company_intelligence tool", () => {
	let mockServer: McpServer;
	let mockEnv: Env;

	beforeEach(() => {
		mockServer = {
			tool: vi.fn(),
		} as unknown as McpServer;

		mockEnv = {
			TANGO_API_KEY: "test-key",
			TANGO_API_BASE_URL: "https://test.api",
			TANGO_CACHE: {} as KVNamespace,
		};
	});

	it("should register the tool", () => {
		registerGetCompanyIntelligenceTool(mockServer, mockEnv);
		expect(mockServer.tool).toHaveBeenCalledWith(
			"get_tango_company_intelligence",
			expect.any(String),
			expect.any(Object),
			expect.any(Function),
		);
	});

	it("should require company_name parameter", () => {
		registerGetCompanyIntelligenceTool(mockServer, mockEnv);
		const toolCall = vi.mocked(mockServer.tool).mock.calls[0];
		const schema = toolCall[2];
		expect(schema).toHaveProperty("company_name");
	});
});
