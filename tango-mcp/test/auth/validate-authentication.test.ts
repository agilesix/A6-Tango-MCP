/**
 * Authentication Validation Tests
 *
 * Tests for Gateway Model authentication enforcement
 */

import { describe, it, expect } from "vitest";
import {
	validateAuthentication,
	getUserIdentifierFromAuth,
	type AuthValidationResult,
} from "../../src/auth/validate-authentication.js";
import type { MCPProps } from "../../src/index.js";
import type { Env } from "../../src/types/env.js";

describe("validateAuthentication", () => {
	describe("OAuth authentication", () => {
		it("should accept valid OAuth with @agile6.com email", async () => {
			const props: MCPProps = {
				accessToken: "mock-oauth-token",
				email: "john.doe@agile6.com",
				name: "John Doe",
			};

			const result = await validateAuthentication(props);

			expect(result.authenticated).toBe(true);
			expect(result.method).toBe("oauth");
			expect(result.user.email).toBe("john.doe@agile6.com");
			expect(result.user.name).toBe("John Doe");
		});

		it("should accept @agile6.com email with case-insensitive check", async () => {
			const props: MCPProps = {
				accessToken: "mock-oauth-token",
				email: "Jane.Smith@AGILE6.COM",
				name: "Jane Smith",
			};

			const result = await validateAuthentication(props);

			expect(result.authenticated).toBe(true);
			expect(result.method).toBe("oauth");
			expect(result.user.email).toBe("Jane.Smith@AGILE6.COM");
		});

		it("should accept @agile6.com email with mixed case", async () => {
			const props: MCPProps = {
				accessToken: "mock-oauth-token",
				email: "test@AgIlE6.CoM",
				name: "Test User",
			};

			const result = await validateAuthentication(props);

			expect(result.authenticated).toBe(true);
			expect(result.method).toBe("oauth");
		});

		it("should reject OAuth with missing email", async () => {
			const props: MCPProps = {
				accessToken: "mock-oauth-token",
				name: "John Doe",
			};

			await expect(validateAuthentication(props)).rejects.toThrow(
				"Unauthorized: OAuth authentication requires email",
			);
		});

		it("should reject OAuth with non-@agile6.com email", async () => {
			const props: MCPProps = {
				accessToken: "mock-oauth-token",
				email: "john.doe@gmail.com",
				name: "John Doe",
			};

			await expect(validateAuthentication(props)).rejects.toThrow(
				"Unauthorized: Only @agile6.com accounts are allowed",
			);
		});

		it("should reject OAuth with @agile6.co email (wrong TLD)", async () => {
			const props: MCPProps = {
				accessToken: "mock-oauth-token",
				email: "john.doe@agile6.co",
				name: "John Doe",
			};

			await expect(validateAuthentication(props)).rejects.toThrow(
				"Unauthorized: Only @agile6.com accounts are allowed",
			);
		});

		it("should reject OAuth with email containing agile6.com but wrong domain", async () => {
			const props: MCPProps = {
				accessToken: "mock-oauth-token",
				email: "john.doe@not-agile6.com",
				name: "John Doe",
			};

			await expect(validateAuthentication(props)).rejects.toThrow(
				"Unauthorized: Only @agile6.com accounts are allowed",
			);
		});
	});

	describe("MCP token authentication", () => {
		it("should reject MCP token without env (requires KV)", async () => {
			const props: MCPProps = {
				mcpAccessToken: "mcp_1234567890abcdef_secrettoken",
			};

			// Without env, MCP token cannot be validated
			await expect(validateAuthentication(props)).rejects.toThrow(
				"Unauthorized: Authentication required",
			);
		});

		it("should reject short MCP token without env", async () => {
			const props: MCPProps = {
				mcpAccessToken: "short",
			};

			// Without env, MCP token cannot be validated
			await expect(validateAuthentication(props)).rejects.toThrow(
				"Unauthorized: Authentication required",
			);
		});

		it("should handle empty string MCP token as unauthenticated", async () => {
			const props: MCPProps = {
				mcpAccessToken: "",
			};

			// Empty string is falsy, so should fall through to unauthenticated
			await expect(validateAuthentication(props)).rejects.toThrow(
				"Unauthorized: Authentication required",
			);
		});
	});

	describe("unauthenticated requests", () => {
		it("should reject request with no authentication", async () => {
			const props: MCPProps = {};

			await expect(validateAuthentication(props)).rejects.toThrow(
				"Unauthorized: Authentication required",
			);
		});

		it("should reject request with undefined props", async () => {
			await expect(validateAuthentication(undefined)).rejects.toThrow(
				"Unauthorized: Authentication required",
			);
		});

		it("should reject request with only tangoApiKey (not enough)", async () => {
			const props: MCPProps = {
				tangoApiKey: "tango-key-123",
			};

			await expect(validateAuthentication(props)).rejects.toThrow(
				"Unauthorized: Authentication required",
			);
		});

		it("should provide clear error message with next steps", async () => {
			const props: MCPProps = {};

			await expect(validateAuthentication(props)).rejects.toThrow(
				/Use OAuth \(Google\) or provide x-mcp-access-token header/,
			);
		});

		it("should mention @agile6.com requirement in error message", async () => {
			const props: MCPProps = {};

			await expect(validateAuthentication(props)).rejects.toThrow(
				/@agile6\.com email addresses/,
			);
		});
	});

	describe("priority and precedence", () => {
		it("should prioritize OAuth over MCP token when both present", async () => {
			const props: MCPProps = {
				accessToken: "oauth-token",
				email: "john@agile6.com",
				name: "John",
				mcpAccessToken: "mcp_token",
			};

			const result = await validateAuthentication(props);

			expect(result.method).toBe("oauth");
			expect(result.user.email).toBe("john@agile6.com");
		});

		it("should still reject OAuth with invalid email even if MCP token present", async () => {
			const props: MCPProps = {
				accessToken: "oauth-token",
				email: "john@gmail.com",
				mcpAccessToken: "mcp_token",
			};

			await expect(validateAuthentication(props)).rejects.toThrow(
				"Unauthorized: Only @agile6.com accounts are allowed",
			);
		});
	});

	describe("getUserIdentifierFromAuth", () => {
		it("should return name for OAuth user", () => {
			const result: AuthValidationResult = {
				authenticated: true,
				method: "oauth",
				user: {
					email: "john@agile6.com",
					name: "John Doe",
				},
			};

			expect(getUserIdentifierFromAuth(result)).toBe("John Doe");
		});

		it("should return email if name not present for OAuth user", () => {
			const result: AuthValidationResult = {
				authenticated: true,
				method: "oauth",
				user: {
					email: "john@agile6.com",
				},
			};

			expect(getUserIdentifierFromAuth(result)).toBe("john@agile6.com");
		});

		it("should return 'OAuth User' if neither name nor email present", () => {
			const result: AuthValidationResult = {
				authenticated: true,
				method: "oauth",
				user: {},
			};

			expect(getUserIdentifierFromAuth(result)).toBe("OAuth User");
		});

		it("should return token ID for MCP token user", () => {
			const result: AuthValidationResult = {
				authenticated: true,
				method: "mcp-token",
				user: {
					tokenId: "mcp_1234...",
				},
			};

			expect(getUserIdentifierFromAuth(result)).toBe("MCP Token (mcp_1234...)");
		});
	});
});
