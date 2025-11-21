/**
 * Integration Tests for MCP Token Header Flow
 *
 * Tests the end-to-end flow of MCP token authentication through the middleware:
 * 1. Request with x-mcp-access-token header arrives
 * 2. Middleware extracts header and injects into ctx.props
 * 3. Agent receives props with mcpAccessToken
 * 4. validateAuthentication() validates the token
 * 5. Request succeeds or fails based on token validity
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	generateMcpAccessToken,
	verifyMcpAccessToken,
	type MCPTokenData,
} from "../../src/auth/mcp-token.js";
import {
	validateAuthentication,
	getUserIdentifierFromAuth,
} from "../../src/auth/validate-authentication.js";
import {
	withMcpHeaderExtraction,
	type MutableExecutionContext,
} from "../../src/middleware/mcp-header-extractor.js";
import type { MCPProps } from "../../src/index.js";
import type { Env } from "../../src/types/env.js";

// Mock KV namespace
class MockKVNamespace implements KVNamespace {
	private store = new Map<string, string>();

	async get(key: string): Promise<string | null> {
		return this.store.get(key) || null;
	}

	async put(key: string, value: string): Promise<void> {
		this.store.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.store.delete(key);
	}

	async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
		const keys = Array.from(this.store.keys());
		const filtered = options?.prefix
			? keys.filter((k) => k.startsWith(options.prefix))
			: keys;
		return { keys: filtered.map((name) => ({ name })) };
	}

	// Stub remaining methods
	async getWithMetadata(): Promise<any> {
		return { value: null, metadata: null };
	}
}

// Create mock environment
function createMockEnv(): Env {
	return {
		OAUTH_KV: new MockKVNamespace(),
		TANGO_API_KEY: "test-tango-key",
		TANGO_API_BASE_URL: "https://api.tango.dev",
	} as Env;
}

describe("MCP Token Header Flow - End-to-End Integration", () => {
	let env: Env;
	let validToken: string;
	let validTokenId: string;

	beforeEach(async () => {
		env = createMockEnv();

		// Generate a valid token for tests
		const result = await generateMcpAccessToken(
			"test@agile6.com",
			"Integration Test Token",
			env,
			"127.0.0.1",
			"Test Agent",
		);
		validToken = result.token;
		validTokenId = result.tokenId;
	});

	describe("successful authentication flow", () => {
		it("should authenticate request with valid MCP token header", async () => {
			// Create a mock handler that simulates the Agent's validateAuthentication
			const mockHandler = {
				fetch: vi.fn(async (req, env: Env, ctx: MutableExecutionContext) => {
					// Simulate what happens in MCPServerAgent.init()
					const props: MCPProps = {
						mcpAccessToken: ctx.props?.mcpAccessToken as string,
					};

					// Validate authentication (this is the actual validation logic)
					const authResult = await validateAuthentication(props, env);

					// Should succeed
					expect(authResult.authenticated).toBe(true);
					expect(authResult.method).toBe("mcp-token");
					expect(authResult.user.tokenId).toBeDefined();

					return new Response(JSON.stringify({ success: true }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://test.workers.dev/mcp", {
				method: "POST",
				headers: {
					"x-mcp-access-token": validToken,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					method: "initialize",
					id: 1,
					params: {},
				}),
			});

			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			const response = await wrappedHandler.fetch(request, env, ctx);

			expect(response.status).toBe(200);
			expect(mockHandler.fetch).toHaveBeenCalled();
		});

		it("should extract token and make it available to validateAuthentication", async () => {
			// This test verifies the full flow: header → props → validation
			const mockHandler = {
				fetch: vi.fn(async (req, env: Env, ctx: MutableExecutionContext) => {
					// Extract props that middleware should have set
					const props: MCPProps = {
						mcpAccessToken: ctx.props?.mcpAccessToken as string,
					};

					// Verify middleware extracted the token
					expect(props.mcpAccessToken).toBe(validToken);

					// Verify the token is valid
					const validation = await verifyMcpAccessToken(
						props.mcpAccessToken,
						env,
						"127.0.0.1",
					);
					expect(validation.valid).toBe(true);

					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://test.workers.dev/sse", {
				headers: {
					"x-mcp-access-token": validToken,
				},
			});

			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, env, ctx);
		});

		it("should work with both /sse and /mcp endpoints", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env: Env, ctx: MutableExecutionContext) => {
					const props: MCPProps = {
						mcpAccessToken: ctx.props?.mcpAccessToken as string,
					};

					const authResult = await validateAuthentication(props, env);
					expect(authResult.authenticated).toBe(true);

					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			// Test /sse endpoint
			const sseRequest = new Request("https://test.workers.dev/sse", {
				headers: { "x-mcp-access-token": validToken },
			});

			const sseCtx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(sseRequest, env, sseCtx);

			// Test /mcp endpoint
			const mcpRequest = new Request("https://test.workers.dev/mcp", {
				headers: { "x-mcp-access-token": validToken },
			});

			const mcpCtx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(mcpRequest, env, mcpCtx);

			expect(mockHandler.fetch).toHaveBeenCalledTimes(2);
		});
	});

	describe("authentication failures", () => {
		it("should reject request with invalid MCP token", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env: Env, ctx: MutableExecutionContext) => {
					const props: MCPProps = {
						mcpAccessToken: ctx.props?.mcpAccessToken as string,
					};

					// Should throw authentication error
					await expect(validateAuthentication(props, env)).rejects.toThrow(
						/Unauthorized/,
					);

					return new Response("Unauthorized", { status: 401 });
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://test.workers.dev/mcp", {
				headers: {
					"x-mcp-access-token": "mcp_v1_invalid_token",
				},
			});

			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, env, ctx);
		});

		it("should reject request with no authentication", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env: Env, ctx: MutableExecutionContext) => {
					const props: MCPProps = {
						mcpAccessToken: ctx.props?.mcpAccessToken as string,
					};

					// Should throw because no auth provided
					await expect(validateAuthentication(props, env)).rejects.toThrow(
						"Unauthorized: Authentication required",
					);

					return new Response("Unauthorized", { status: 401 });
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://test.workers.dev/mcp");

			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, env, ctx);
		});

		it("should reject request with malformed token", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env: Env, ctx: MutableExecutionContext) => {
					const props: MCPProps = {
						mcpAccessToken: ctx.props?.mcpAccessToken as string,
					};

					await expect(validateAuthentication(props, env)).rejects.toThrow();

					return new Response("Unauthorized", { status: 401 });
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://test.workers.dev/mcp", {
				headers: {
					"x-mcp-access-token": "not-a-valid-format",
				},
			});

			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, env, ctx);
		});
	});

	describe("OAuth compatibility", () => {
		it("should not break OAuth flow when MCP header is absent", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env: Env, ctx: MutableExecutionContext) => {
					// Simulate OAuth props already set by OAuthProvider
					const props: MCPProps = {
						name: "OAuth User",
						email: "user@agile6.com",
						accessToken: "oauth_token_123",
						mcpAccessToken: ctx.props?.mcpAccessToken as string,
					};

					// Should authenticate via OAuth (not MCP token)
					const authResult = await validateAuthentication(props, env);
					expect(authResult.authenticated).toBe(true);
					expect(authResult.method).toBe("oauth");
					expect(authResult.user.email).toBe("user@agile6.com");

					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://test.workers.dev/sse", {
				headers: {
					Cookie: "oauth_session=valid_session",
				},
			});

			// Simulate OAuthProvider already setting props
			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
				props: {
					name: "OAuth User",
					email: "user@agile6.com",
					accessToken: "oauth_token_123",
				},
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, env, ctx);
		});

		it("should prioritize OAuth when both OAuth and MCP token present", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env: Env, ctx: MutableExecutionContext) => {
					const props: MCPProps = {
						name: "OAuth User",
						email: "user@agile6.com",
						accessToken: "oauth_token_123",
						mcpAccessToken: ctx.props?.mcpAccessToken as string,
					};

					// Should authenticate via OAuth (priority over MCP token)
					const authResult = await validateAuthentication(props, env);
					expect(authResult.authenticated).toBe(true);
					expect(authResult.method).toBe("oauth");

					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://test.workers.dev/mcp", {
				headers: {
					"x-mcp-access-token": validToken,
					Cookie: "oauth_session=valid_session",
				},
			});

			// Simulate OAuthProvider already setting props
			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
				props: {
					name: "OAuth User",
					email: "user@agile6.com",
					accessToken: "oauth_token_123",
				},
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, env, ctx);
		});
	});

	describe("token validation with IP tracking", () => {
		it("should pass IP address to token validation", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env: Env, ctx: MutableExecutionContext) => {
					const props: MCPProps = {
						mcpAccessToken: ctx.props?.mcpAccessToken as string,
					};

					// Verify token with IP address
					const validation = await verifyMcpAccessToken(
						props.mcpAccessToken,
						env,
						"127.0.0.1",
					);

					expect(validation.valid).toBe(true);
					expect(validation.userId).toBe("test@agile6.com");
					expect(validation.tokenData).toBeDefined();

					// Note: lastUsedFrom is updated asynchronously (fire-and-forget)
					// so we verify the token data exists but don't check lastUsedFrom immediately

					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://test.workers.dev/mcp", {
				headers: {
					"x-mcp-access-token": validToken,
				},
			});

			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, env, ctx);
		});
	});

	describe("user identifier extraction", () => {
		it("should extract correct user identifier for MCP token", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env: Env, ctx: MutableExecutionContext) => {
					const props: MCPProps = {
						mcpAccessToken: ctx.props?.mcpAccessToken as string,
					};

					const authResult = await validateAuthentication(props, env);
					const userIdentifier = getUserIdentifierFromAuth(authResult);

					// Should return token ID format
					expect(userIdentifier).toContain("MCP Token");
					expect(userIdentifier).toContain(validTokenId);

					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://test.workers.dev/mcp", {
				headers: {
					"x-mcp-access-token": validToken,
				},
			});

			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, env, ctx);
		});
	});

	describe("concurrent requests", () => {
		it("should handle multiple concurrent requests with different tokens", async () => {
			// Generate second token
			const result2 = await generateMcpAccessToken(
				"user2@agile6.com",
				"Second Token",
				env,
				"192.168.1.1",
				"Test Agent 2",
			);

			const mockHandler = {
				fetch: vi.fn(async (req, env: Env, ctx: MutableExecutionContext) => {
					const props: MCPProps = {
						mcpAccessToken: ctx.props?.mcpAccessToken as string,
					};

					const authResult = await validateAuthentication(props, env);
					expect(authResult.authenticated).toBe(true);

					return new Response(JSON.stringify({ token: props.mcpAccessToken }));
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			// Make concurrent requests
			const request1 = new Request("https://test.workers.dev/mcp", {
				headers: { "x-mcp-access-token": validToken },
			});

			const request2 = new Request("https://test.workers.dev/mcp", {
				headers: { "x-mcp-access-token": result2.token },
			});

			const ctx1 = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			const ctx2 = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			const [response1, response2] = await Promise.all([
				wrappedHandler.fetch(request1, env, ctx1),
				wrappedHandler.fetch(request2, env, ctx2),
			]);

			expect(response1.status).toBe(200);
			expect(response2.status).toBe(200);

			const data1 = await response1.json();
			const data2 = await response2.json();

			expect(data1.token).toBe(validToken);
			expect(data2.token).toBe(result2.token);
		});
	});
});
