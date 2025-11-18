/**
 * Unit Tests for Echo Tool
 */

import { describe, it, expect } from "vitest";
import {
	createMockServer,
	expectToolSuccess,
	expectToolError,
	getToolResponseText,
	parseToolResponse,
} from "../../utils/test-utils.js";
import { registerEchoTool } from "../../../src/tools/echo.js";

describe("Echo Tool", () => {
	it("should echo back a simple message", async () => {
		const server = createMockServer();
		registerEchoTool(server);

		const response = await expectToolSuccess(server, "echo", {
			message: "Hello, World!",
		});

		const text = getToolResponseText(response);
		expect(text).toBe("Echo: Hello, World!");
	});

	it("should handle empty messages", async () => {
		const server = createMockServer();
		registerEchoTool(server);

		const response = await expectToolSuccess(server, "echo", {
			message: "",
		});

		const text = getToolResponseText(response);
		expect(text).toBe("Echo: ");
	});

	it("should handle messages with special characters", async () => {
		const server = createMockServer();
		registerEchoTool(server);

		const specialMessage = "Test: @#$%^&*() 你好 🚀";
		const response = await expectToolSuccess(server, "echo", {
			message: specialMessage,
		});

		const text = getToolResponseText(response);
		expect(text).toBe(`Echo: ${specialMessage}`);
	});

	it("should handle multiline messages", async () => {
		const server = createMockServer();
		registerEchoTool(server);

		const multilineMessage = "Line 1\nLine 2\nLine 3";
		const response = await expectToolSuccess(server, "echo", {
			message: multilineMessage,
		});

		const text = getToolResponseText(response);
		expect(text).toBe(`Echo: ${multilineMessage}`);
	});

	it("should require message parameter", async () => {
		const server = createMockServer();
		registerEchoTool(server);

		// Missing message parameter should cause validation error
		await expect(
			expectToolSuccess(server, "echo", {}),
		).rejects.toThrow();
	});

	it("should reject non-string messages", async () => {
		const server = createMockServer();
		registerEchoTool(server);

		// Number instead of string should cause validation error
		await expect(
			expectToolSuccess(server, "echo", { message: 123 as any }),
		).rejects.toThrow();
	});

	it("should return text content type", async () => {
		const server = createMockServer();
		registerEchoTool(server);

		const response = await expectToolSuccess(server, "echo", {
			message: "test",
		});

		expect(response.content).toHaveLength(1);
		expect(response.content[0].type).toBe("text");
	});

	it("should not be marked as an error", async () => {
		const server = createMockServer();
		registerEchoTool(server);

		const response = await expectToolSuccess(server, "echo", {
			message: "test",
		});

		expect(response.isError).toBeUndefined();
	});
});
