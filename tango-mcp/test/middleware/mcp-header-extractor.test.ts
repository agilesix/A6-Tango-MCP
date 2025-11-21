/**
 * MCP Header Extraction Middleware Tests
 *
 * Unit tests for the middleware that extracts x-mcp-access-token headers
 * and injects them into ExecutionContext props.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	withMcpHeaderExtraction,
	type MutableExecutionContext,
} from "../../src/middleware/mcp-header-extractor.js";

describe("MCP Header Extraction Middleware", () => {
	describe("header extraction", () => {
		it("should extract x-mcp-access-token header into ctx.props", async () => {
			// Mock handler that verifies props were injected
			const mockHandler = {
				fetch: vi.fn(async (req, env, ctx: MutableExecutionContext) => {
					// Verify props were injected
					expect(ctx.props).toBeDefined();
					expect(ctx.props?.mcpAccessToken).toBe("mcp_v1_test_token_123");
					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://example.com/mcp", {
				headers: {
					"x-mcp-access-token": "mcp_v1_test_token_123",
				},
			});

			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, {}, ctx);

			expect(mockHandler.fetch).toHaveBeenCalled();
		});

		it("should handle case-insensitive header names", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env, ctx: MutableExecutionContext) => {
					expect(ctx.props?.mcpAccessToken).toBe("test_token");
					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			// Test uppercase header
			const request1 = new Request("https://example.com/mcp", {
				headers: {
					"X-MCP-ACCESS-TOKEN": "test_token",
				},
			});

			const ctx1 = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request1, {}, ctx1);

			// Test mixed case header
			const request2 = new Request("https://example.com/mcp", {
				headers: {
					"X-Mcp-Access-Token": "test_token",
				},
			});

			const ctx2 = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request2, {}, ctx2);

			expect(mockHandler.fetch).toHaveBeenCalledTimes(2);
		});

		it("should initialize props if not already present", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env, ctx: MutableExecutionContext) => {
					// Props should be initialized (empty object) even without token
					expect(ctx.props).toBeDefined();
					expect(typeof ctx.props).toBe("object");
					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://example.com/mcp");
			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, {}, ctx);
		});

		it("should not modify props if no MCP token present", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env, ctx: MutableExecutionContext) => {
					// Props should be initialized but no mcpAccessToken
					expect(ctx.props).toBeDefined();
					expect(ctx.props?.mcpAccessToken).toBeUndefined();
					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://example.com/mcp");
			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, {}, ctx);
		});
	});

	describe("props preservation", () => {
		it("should preserve existing props from OAuth", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env, ctx: MutableExecutionContext) => {
					// Should have both OAuth and MCP props
					expect(ctx.props?.name).toBe("Test User");
					expect(ctx.props?.email).toBe("test@agile6.com");
					expect(ctx.props?.accessToken).toBe("oauth_token");
					expect(ctx.props?.mcpAccessToken).toBe("mcp_v1_test_token_123");
					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://example.com/mcp", {
				headers: {
					"x-mcp-access-token": "mcp_v1_test_token_123",
				},
			});

			// Simulate OAuth already setting props
			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
				props: {
					name: "Test User",
					email: "test@agile6.com",
					accessToken: "oauth_token",
				},
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, {}, ctx);
		});

		it("should not overwrite existing mcpAccessToken if present", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env, ctx: MutableExecutionContext) => {
					// Should use the token from the header
					expect(ctx.props?.mcpAccessToken).toBe("new_token");
					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://example.com/mcp", {
				headers: {
					"x-mcp-access-token": "new_token",
				},
			});

			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
				props: {
					mcpAccessToken: "old_token",
				},
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, {}, ctx);
		});
	});

	describe("handler pass-through", () => {
		it("should pass control to wrapped handler", async () => {
			const mockHandler = {
				fetch: vi.fn(async () => new Response("Handler Called")),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://example.com/mcp");
			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			const response = await wrappedHandler.fetch(request, {}, ctx);

			expect(mockHandler.fetch).toHaveBeenCalled();
			expect(await response.text()).toBe("Handler Called");
		});

		it("should pass request, env, and ctx to wrapped handler", async () => {
			const mockEnv = { TEST_ENV: "test" };
			const mockHandler = {
				fetch: vi.fn(async (req, env, ctx) => {
					expect(req).toBeInstanceOf(Request);
					expect(env).toBe(mockEnv);
					expect(ctx).toBeDefined();
					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://example.com/mcp");
			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, mockEnv, ctx);
		});

		it("should return response from wrapped handler", async () => {
			const expectedResponse = new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});

			const mockHandler = {
				fetch: vi.fn(async () => expectedResponse),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://example.com/mcp");
			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			const response = await wrappedHandler.fetch(request, {}, ctx);

			expect(response).toBe(expectedResponse);
			expect(response.status).toBe(200);
		});
	});

	describe("edge cases", () => {
		it("should handle empty string token", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env, ctx: MutableExecutionContext) => {
					// Empty string is falsy, so mcpAccessToken should not be set
					expect(ctx.props?.mcpAccessToken).toBeUndefined();
					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://example.com/mcp", {
				headers: {
					"x-mcp-access-token": "",
				},
			});

			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, {}, ctx);
		});

		it("should handle whitespace-only token", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env, ctx: MutableExecutionContext) => {
					// Headers.get() trims whitespace, so whitespace-only becomes empty
					// Empty string is falsy, so mcpAccessToken should not be set
					expect(ctx.props?.mcpAccessToken).toBeUndefined();
					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://example.com/mcp", {
				headers: {
					"x-mcp-access-token": "   ",
				},
			});

			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, {}, ctx);
		});

		it("should handle very long tokens", async () => {
			const longToken = "mcp_v1_" + "a".repeat(1000);

			const mockHandler = {
				fetch: vi.fn(async (req, env, ctx: MutableExecutionContext) => {
					expect(ctx.props?.mcpAccessToken).toBe(longToken);
					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://example.com/mcp", {
				headers: {
					"x-mcp-access-token": longToken,
				},
			});

			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, {}, ctx);
		});

		it("should handle special characters in token", async () => {
			const tokenWithSpecialChars = "mcp_v1_token!@#$%^&*()_+-=[]{}|;:',.<>?";

			const mockHandler = {
				fetch: vi.fn(async (req, env, ctx: MutableExecutionContext) => {
					expect(ctx.props?.mcpAccessToken).toBe(tokenWithSpecialChars);
					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://example.com/mcp", {
				headers: {
					"x-mcp-access-token": tokenWithSpecialChars,
				},
			});

			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, {}, ctx);
		});
	});

	describe("OAuth integration", () => {
		it("should not interfere with OAuth flow when MCP token not present", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env, ctx: MutableExecutionContext) => {
					// OAuth props should be unchanged
					expect(ctx.props?.name).toBe("OAuth User");
					expect(ctx.props?.email).toBe("user@agile6.com");
					expect(ctx.props?.accessToken).toBe("oauth_token_123");
					expect(ctx.props?.mcpAccessToken).toBeUndefined();
					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://example.com/sse", {
				headers: {
					Cookie: "oauth_session=valid_session",
				},
			});

			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
				props: {
					name: "OAuth User",
					email: "user@agile6.com",
					accessToken: "oauth_token_123",
				},
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request, {}, ctx);
		});

		it("should work with both /sse and /mcp endpoints", async () => {
			const mockHandler = {
				fetch: vi.fn(async (req, env, ctx: MutableExecutionContext) => {
					expect(ctx.props?.mcpAccessToken).toBe("test_token");
					return new Response("OK");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			// Test /sse endpoint
			const request1 = new Request("https://example.com/sse", {
				headers: {
					"x-mcp-access-token": "test_token",
				},
			});

			const ctx1 = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request1, {}, ctx1);

			// Test /mcp endpoint
			const request2 = new Request("https://example.com/mcp", {
				headers: {
					"x-mcp-access-token": "test_token",
				},
			});

			const ctx2 = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await wrappedHandler.fetch(request2, {}, ctx2);

			expect(mockHandler.fetch).toHaveBeenCalledTimes(2);
		});
	});

	describe("error handling", () => {
		it("should propagate errors from wrapped handler", async () => {
			const mockHandler = {
				fetch: vi.fn(async () => {
					throw new Error("Handler Error");
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://example.com/mcp");
			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			await expect(
				wrappedHandler.fetch(request, {}, ctx),
			).rejects.toThrow("Handler Error");
		});

		it("should not catch errors from wrapped handler", async () => {
			const mockHandler = {
				fetch: vi.fn(async () => {
					return new Response("Unauthorized", { status: 401 });
				}),
			};

			const wrappedHandler = withMcpHeaderExtraction(mockHandler);

			const request = new Request("https://example.com/mcp");
			const ctx = {
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			} as unknown as ExecutionContext;

			const response = await wrappedHandler.fetch(request, {}, ctx);

			expect(response.status).toBe(401);
		});
	});
});
