/**
 * MCP Client Helper for Integration Tests
 *
 * Provides a TypeScript client for testing the MCP server using the official MCP SDK.
 * This client uses the proper transport classes instead of raw fetch() calls.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { z } from "zod";

export interface MCPRequest {
	jsonrpc: "2.0";
	id: number;
	method: string;
	params?: Record<string, any>;
}

export interface MCPResponse {
	jsonrpc: "2.0";
	id: number;
	result?: any;
	error?: {
		code: number;
		message: string;
		data?: any;
	};
}

export interface MCPToolCallResult {
	content: Array<{
		type: string;
		text: string;
	}>;
	isError?: boolean;
}

type Transport = StreamableHTTPClientTransport | SSEClientTransport;

export class MCPClient {
	private serverUrl: string;
	private client: Client | null = null;
	private transport: Transport | null = null;
	private connected = false;

	constructor(serverUrl = "http://localhost:8788/mcp") {
		this.serverUrl = serverUrl;
	}

	/**
	 * Connect to the MCP server with automatic transport detection
	 * Tries StreamableHTTP first, falls back to SSE if needed
	 */
	private async connect(): Promise<void> {
		if (this.connected && this.client && this.transport) {
			return;
		}

		const baseUrl = new URL(this.serverUrl);

		// Create client instance
		this.client = new Client(
			{
				name: "mcp-test-client",
				version: "1.0.0",
			},
			{
				capabilities: {},
			},
		);

		// Error handler
		this.client.onerror = (error) => {
			console.error("MCP Client error:", error);
		};

		// Try StreamableHTTP transport first (recommended)
		try {
			this.transport = new StreamableHTTPClientTransport(baseUrl);
			await this.client.connect(this.transport);
			this.connected = true;
			return;
		} catch (error) {
			// If streamable-http fails, try SSE transport
			console.log(
				`StreamableHTTP transport failed, trying SSE: ${error}`,
			);

			try {
				// Create new client for SSE attempt
				this.client = new Client(
					{
						name: "mcp-test-client",
						version: "1.0.0",
					},
					{
						capabilities: {},
					},
				);

				this.transport = new SSEClientTransport(baseUrl);
				await this.client.connect(this.transport);
				this.connected = true;
				return;
			} catch (sseError) {
				throw new Error(
					`Failed to connect with either transport: ${error}, ${sseError}`,
				);
			}
		}
	}

	/**
	 * Make an MCP request to the server
	 */
	async request(
		method: string,
		params: Record<string, any> = {},
	): Promise<MCPResponse> {
		await this.connect();

		if (!this.client) {
			throw new Error("Client not connected");
		}

		try {
			// Use a pass-through Zod schema that accepts any object
			const passThroughSchema = z.object({}).passthrough();

			const result = await this.client.request(
				{
					method,
					params,
				},
				passThroughSchema,
			);

			return {
				jsonrpc: "2.0",
				id: 1,
				result,
			};
		} catch (error: any) {
			return {
				jsonrpc: "2.0",
				id: 1,
				error: {
					code: -32603,
					message: error.message || "Internal error",
					data: error,
				},
			};
		}
	}

	/**
	 * Call an MCP tool
	 */
	async callTool(
		toolName: string,
		args: Record<string, any> = {},
	): Promise<MCPToolCallResult> {
		const response = await this.request("tools/call", {
			name: toolName,
			arguments: args,
		});

		if (response.error) {
			throw new Error(`Tool call failed: ${response.error.message}`);
		}

		if (!response.result || !response.result.content) {
			throw new Error("Invalid tool call response: missing content");
		}

		return response.result;
	}

	/**
	 * Get text content from tool call result
	 */
	getTextContent(result: MCPToolCallResult): string {
		if (!result.content || result.content.length === 0) {
			return "";
		}

		return result.content[0].text || "";
	}

	/**
	 * List available tools
	 */
	async listTools(): Promise<any> {
		const response = await this.request("tools/list");

		if (response.error) {
			throw new Error(`Failed to list tools: ${response.error.message}`);
		}

		return response.result;
	}

	/**
	 * List available prompts
	 */
	async listPrompts(): Promise<any> {
		const response = await this.request("prompts/list");

		if (response.error) {
			throw new Error(`Failed to list prompts: ${response.error.message}`);
		}

		return response.result;
	}

	/**
	 * Get a prompt with arguments
	 */
	async getPrompt(
		promptName: string,
		args: Record<string, any> = {},
	): Promise<any> {
		const response = await this.request("prompts/get", {
			name: promptName,
			arguments: args,
		});

		if (response.error) {
			throw new Error(`Failed to get prompt: ${response.error.message}`);
		}

		return response.result;
	}

	/**
	 * List available resources
	 */
	async listResources(): Promise<any> {
		const response = await this.request("resources/list");

		if (response.error) {
			throw new Error(`Failed to list resources: ${response.error.message}`);
		}

		return response.result;
	}

	/**
	 * Read a resource by URI
	 */
	async readResource(uri: string): Promise<any> {
		const response = await this.request("resources/read", { uri });

		if (response.error) {
			throw new Error(`Failed to read resource: ${response.error.message}`);
		}

		return response.result;
	}

	/**
	 * Initialize the MCP session
	 */
	async initialize(_params = {}): Promise<any> {
		// Connection happens automatically in connect()
		// The SDK client handles initialization during connect()
		await this.connect();

		// Return server info from the transport
		if (!this.client) {
			throw new Error("Client not connected");
		}

		// Get server info from the client
		const serverInfo = (this.client as any).serverInfo;
		const capabilities = (this.client as any).serverCapabilities;

		return {
			protocolVersion: "2024-11-05",
			capabilities: capabilities || {},
			serverInfo: serverInfo || {
				name: "MCP Server",
				version: "1.0.0",
			},
		};
	}

	/**
	 * Check if server is available
	 */
	async isServerAvailable(): Promise<boolean> {
		try {
			await this.connect();
			return this.connected;
		} catch {
			return false;
		}
	}

	/**
	 * Get current session ID
	 */
	getSessionId(): string | null {
		if (!this.transport) {
			return null;
		}

		// Try to get session ID from transport
		if ("sessionId" in this.transport) {
			return (this.transport as any).sessionId || null;
		}

		return null;
	}

	/**
	 * Reset session (for testing)
	 */
	resetSession(): void {
		this.connected = false;
		this.client = null;
		this.transport = null;
	}

	/**
	 * Close the connection
	 */
	async close(): Promise<void> {
		if (this.transport) {
			try {
				await this.transport.close();
			} catch (error) {
				console.error("Error closing transport:", error);
			}
		}

		this.connected = false;
		this.client = null;
		this.transport = null;
	}
}

/**
 * Create a new MCP client instance
 */
export function createMCPClient(serverUrl?: string): MCPClient {
	return new MCPClient(serverUrl);
}
