/**
 * MCP Client Adapter
 *
 * Adapts the project-specific MCPClient to the IMCPTestClient interface.
 *
 * Design: Project-specific integration layer
 */

import { MCPClient } from "./mcp-client.js";
import type {
	IMCPTestClient,
	MCPToolResponse,
	MCPTool,
	MCPServerInfo,
	MCPPrompt,
	MCPPromptResponse,
	MCPResource,
	MCPResourceContent,
} from "../harness/types/client.ts";

/**
 * Adapter that wraps the project's MCPClient to implement IMCPTestClient
 */
export class MCPClientAdapter implements IMCPTestClient {
	private client: MCPClient;

	constructor(serverUrl: string) {
		this.client = new MCPClient(serverUrl);
	}

	/**
	 * Connect to the MCP server
	 */
	async connect(): Promise<void> {
		await this.client.initialize();
	}

	/**
	 * Disconnect from the MCP server
	 */
	async disconnect(): Promise<void> {
		// MCPClient doesn't have explicit disconnect, but we can reset session
		this.client.resetSession();
	}

	/**
	 * Call an MCP tool
	 */
	async callTool(
		name: string,
		args: Record<string, any>,
	): Promise<MCPToolResponse> {
		const result = await this.client.callTool(name, args);

		return {
			content: result.content,
			isError: result.isError,
		};
	}

	/**
	 * List available tools
	 */
	async listTools(): Promise<MCPTool[]> {
		const result = await this.client.listTools();

		return result.tools.map((tool: any) => ({
			name: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema,
		}));
	}

	/**
	 * Get server information
	 */
	async getServerInfo(): Promise<MCPServerInfo> {
		// Initialize first to get server info
		const initResult = await this.client.initialize();

		return {
			name: initResult.serverInfo?.name || "MCP Server",
			version: initResult.serverInfo?.version || "1.0.0",
			protocolVersion: initResult.protocolVersion || "unknown",
			capabilities: initResult.capabilities,
		};
	}

	/**
	 * List available prompts
	 */
	async listPrompts(): Promise<MCPPrompt[]> {
		const result = await this.client.listPrompts();

		return result.prompts.map((prompt: any) => ({
			name: prompt.name,
			description: prompt.description,
			argsSchema: prompt.argsSchema,
		}));
	}

	/**
	 * Get a prompt with arguments
	 */
	async getPrompt(
		name: string,
		args?: Record<string, unknown>,
	): Promise<MCPPromptResponse> {
		const result = await this.client.getPrompt(name, args || {});
		return result;
	}

	/**
	 * List available resources
	 */
	async listResources(): Promise<MCPResource[]> {
		const result = await this.client.listResources();

		return result.resources.map((resource: any) => ({
			uri: resource.uri,
			name: resource.name,
			description: resource.description,
			mimeType: resource.mimeType,
		}));
	}

	/**
	 * Read a resource by URI
	 */
	async readResource(uri: string): Promise<MCPResourceContent> {
		const result = await this.client.readResource(uri);
		return result;
	}
}
