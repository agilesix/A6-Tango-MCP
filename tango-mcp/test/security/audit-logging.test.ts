/**
 * Tests for audit logging module
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	AuditLogger,
	getAuditLogger,
	createAuditEntry,
	type AuditLogEntry,
} from "../../src/security/audit-logging";

// Mock console.log to capture audit logs
const mockLog = vi.spyOn(console, "log");

describe("AuditLogger", () => {
	let logger: AuditLogger;
	let mockRequest: Request;

	beforeEach(() => {
		logger = new AuditLogger();
		mockRequest = new Request("https://example.com", {
			headers: {
				"CF-Connecting-IP": "1.2.3.4",
				"User-Agent": "TestAgent/1.0",
			},
		});
		mockLog.mockClear();
	});

	describe("log()", () => {
		it("should log audit entry to console", async () => {
			const entry: AuditLogEntry = {
				timestamp: "2025-11-21T12:00:00.000Z",
				event_category: "auth",
				event_type: "login",
				event_action: "success",
				severity: "info",
				client_ip: "1.2.3.4",
				user_agent: "TestAgent/1.0",
				success: true,
			};

			await logger.log(entry);

			expect(mockLog).toHaveBeenCalledWith("[AUDIT]", JSON.stringify(entry));
		});

		it("should handle entries with all optional fields", async () => {
			const entry: AuditLogEntry = {
				timestamp: "2025-11-21T12:00:00.000Z",
				event_category: "api",
				event_type: "tool_execution",
				event_action: "success",
				severity: "info",
				user_email: "user@agile6.com",
				user_name: "Test User",
				token_id: "mcp_1234...",
				client_ip: "1.2.3.4",
				user_agent: "TestAgent/1.0",
				session_id: "session-123",
				resource_type: "tool",
				resource_id: "search_contracts",
				success: true,
				metadata: {
					additional: "data",
				},
				trace_id: "trace-123",
			};

			await logger.log(entry);

			expect(mockLog).toHaveBeenCalledWith("[AUDIT]", JSON.stringify(entry));
		});
	});

	describe("logAuthAttempt()", () => {
		it("should log successful OAuth authentication", async () => {
			await logger.logAuthAttempt(
				true,
				"oauth",
				{
					email: "user@agile6.com",
					name: "Test User",
				},
				mockRequest
			);

			expect(mockLog).toHaveBeenCalled();
			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.event_category).toBe("auth");
			expect(loggedEntry.event_type).toBe("authentication");
			expect(loggedEntry.event_action).toBe("success");
			expect(loggedEntry.severity).toBe("info");
			expect(loggedEntry.user_email).toBe("user@agile6.com");
			expect(loggedEntry.user_name).toBe("Test User");
			expect(loggedEntry.success).toBe(true);
			expect(loggedEntry.metadata.auth_method).toBe("oauth");
		});

		it("should log failed authentication attempt", async () => {
			await logger.logAuthAttempt(
				false,
				"none",
				{},
				mockRequest,
				"Missing credentials"
			);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.event_action).toBe("failure");
			expect(loggedEntry.severity).toBe("warning");
			expect(loggedEntry.success).toBe(false);
			expect(loggedEntry.error_message).toBe("Missing credentials");
		});

		it("should log MCP token authentication with truncated token ID", async () => {
			await logger.logAuthAttempt(
				true,
				"mcp-token",
				{
					tokenId: "mcp_v1_1234567890abcdef",
				},
				mockRequest
			);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.token_id).toBe("mcp_v1_1...");
			expect(loggedEntry.metadata.auth_method).toBe("mcp-token");
		});

		it("should extract client IP and user agent", async () => {
			await logger.logAuthAttempt(
				true,
				"oauth",
				{ email: "user@agile6.com" },
				mockRequest
			);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.client_ip).toBe("1.2.3.4");
			expect(loggedEntry.user_agent).toBe("TestAgent/1.0");
		});
	});

	describe("logOAuthCallback()", () => {
		it("should log successful OAuth callback", async () => {
			await logger.logOAuthCallback(true, "user@agile6.com", mockRequest);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.event_category).toBe("oauth");
			expect(loggedEntry.event_type).toBe("oauth_callback");
			expect(loggedEntry.event_action).toBe("success");
			expect(loggedEntry.severity).toBe("info");
			expect(loggedEntry.user_email).toBe("user@agile6.com");
			expect(loggedEntry.success).toBe(true);
			expect(loggedEntry.metadata.oauth_provider).toBe("google");
		});

		it("should log failed OAuth callback", async () => {
			await logger.logOAuthCallback(
				false,
				undefined,
				mockRequest,
				"Invalid state token"
			);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.event_action).toBe("failure");
			expect(loggedEntry.severity).toBe("error");
			expect(loggedEntry.success).toBe(false);
			expect(loggedEntry.error_message).toBe("Invalid state token");
		});
	});

	describe("logTokenValidation()", () => {
		it("should log successful token validation", async () => {
			await logger.logTokenValidation(
				true,
				"mcp_v1_1234567890abcdef",
				"user@agile6.com",
				mockRequest
			);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.event_category).toBe("auth");
			expect(loggedEntry.event_type).toBe("token_validation");
			expect(loggedEntry.event_action).toBe("success");
			expect(loggedEntry.severity).toBe("info");
			expect(loggedEntry.token_id).toBe("mcp_v1_1...");
			expect(loggedEntry.user_id).toBe("user@agile6.com");
			expect(loggedEntry.success).toBe(true);
		});

		it("should log failed token validation", async () => {
			await logger.logTokenValidation(
				false,
				"invalid_token",
				undefined,
				mockRequest,
				"Token not found"
			);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.event_action).toBe("failure");
			expect(loggedEntry.severity).toBe("warning");
			expect(loggedEntry.success).toBe(false);
			expect(loggedEntry.error_message).toBe("Token not found");
		});
	});

	describe("logToolExecution()", () => {
		it("should log successful tool execution", async () => {
			await logger.logToolExecution(
				"search_contracts",
				{
					email: "user@agile6.com",
					name: "Test User",
				},
				mockRequest,
				true
			);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.event_category).toBe("api");
			expect(loggedEntry.event_type).toBe("tool_execution");
			expect(loggedEntry.event_action).toBe("success");
			expect(loggedEntry.resource_type).toBe("tool");
			expect(loggedEntry.resource_id).toBe("search_contracts");
			expect(loggedEntry.user_email).toBe("user@agile6.com");
			expect(loggedEntry.success).toBe(true);
		});

		it("should log failed tool execution", async () => {
			await logger.logToolExecution(
				"search_contracts",
				{ email: "user@agile6.com" },
				mockRequest,
				false,
				"API key invalid"
			);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.event_action).toBe("failure");
			expect(loggedEntry.severity).toBe("error");
			expect(loggedEntry.success).toBe(false);
			expect(loggedEntry.error_message).toBe("API key invalid");
		});

		it("should handle MCP token user", async () => {
			await logger.logToolExecution(
				"search_contracts",
				{ tokenId: "mcp_v1_1234567890abcdef" },
				mockRequest,
				true
			);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.token_id).toBe("mcp_v1_1...");
			expect(loggedEntry.user_email).toBeUndefined();
		});
	});

	describe("logSecurityEvent()", () => {
		it("should log security event with details", async () => {
			await logger.logSecurityEvent(
				"suspicious_activity",
				"warning",
				mockRequest,
				{
					attempts: 10,
					pattern: "brute_force",
				}
			);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.event_category).toBe("security");
			expect(loggedEntry.event_type).toBe("suspicious_activity");
			expect(loggedEntry.event_action).toBe("detected");
			expect(loggedEntry.severity).toBe("warning");
			expect(loggedEntry.success).toBe(false);
			expect(loggedEntry.metadata.attempts).toBe(10);
			expect(loggedEntry.metadata.pattern).toBe("brute_force");
		});
	});

	describe("logRateLimitViolation()", () => {
		it("should log rate limit violation", async () => {
			await logger.logRateLimitViolation(
				"auth_endpoint",
				"user@agile6.com",
				mockRequest,
				15,
				10
			);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.event_type).toBe("rate_limit_exceeded");
			expect(loggedEntry.severity).toBe("warning");
			expect(loggedEntry.metadata.limit_type).toBe("auth_endpoint");
			expect(loggedEntry.metadata.current_count).toBe(15);
			expect(loggedEntry.metadata.limit).toBe(10);
		});

		it("should sanitize email in rate limit key", async () => {
			await logger.logRateLimitViolation(
				"tool_execution",
				"john.doe@agile6.com",
				mockRequest,
				100,
				60
			);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.metadata.rate_limit_key).toBe("jo***e@agile6.com");
		});

		it("should sanitize IP in rate limit key", async () => {
			await logger.logRateLimitViolation(
				"auth_endpoint",
				"192.168.1.100",
				mockRequest,
				15,
				10
			);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.metadata.rate_limit_key).toBe("192.168.1.***");
		});
	});

	describe("logOAuthStateFailure()", () => {
		it("should log OAuth state validation failure", async () => {
			await logger.logOAuthStateFailure("State token expired", mockRequest);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.event_type).toBe("oauth_state_validation_failed");
			expect(loggedEntry.severity).toBe("warning");
			expect(loggedEntry.metadata.failure_reason).toBe("State token expired");
		});
	});

	describe("logCSRFFailure()", () => {
		it("should log CSRF validation failure", async () => {
			await logger.logCSRFFailure(mockRequest);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);

			expect(loggedEntry.event_type).toBe("csrf_validation_failed");
			expect(loggedEntry.severity).toBe("warning");
			expect(loggedEntry.metadata.failure_reason).toBe("CSRF token mismatch");
		});
	});

	describe("Token truncation", () => {
		it("should truncate long tokens", async () => {
			await logger.logAuthAttempt(
				true,
				"mcp-token",
				{ tokenId: "mcp_v1_verylongtokenstring1234567890" },
				mockRequest
			);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);
			expect(loggedEntry.token_id).toBe("mcp_v1_v...");
		});

		it("should not truncate short tokens", async () => {
			await logger.logAuthAttempt(
				true,
				"mcp-token",
				{ tokenId: "short" },
				mockRequest
			);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);
			expect(loggedEntry.token_id).toBe("short");
		});
	});

	describe("IP extraction", () => {
		it("should prioritize CF-Connecting-IP", async () => {
			const request = new Request("https://example.com", {
				headers: {
					"CF-Connecting-IP": "1.2.3.4",
					"X-Forwarded-For": "5.6.7.8",
					"X-Real-IP": "9.10.11.12",
				},
			});

			await logger.logAuthAttempt(true, "oauth", {}, request);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);
			expect(loggedEntry.client_ip).toBe("1.2.3.4");
		});

		it("should fall back to X-Forwarded-For", async () => {
			const request = new Request("https://example.com", {
				headers: {
					"X-Forwarded-For": "5.6.7.8, 9.10.11.12",
					"X-Real-IP": "1.2.3.4",
				},
			});

			await logger.logAuthAttempt(true, "oauth", {}, request);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);
			expect(loggedEntry.client_ip).toBe("5.6.7.8");
		});

		it("should return 'unknown' if no IP headers", async () => {
			const request = new Request("https://example.com");

			await logger.logAuthAttempt(true, "oauth", {}, request);

			const loggedEntry = JSON.parse(mockLog.mock.calls[0][1]);
			expect(loggedEntry.client_ip).toBe("unknown");
		});
	});
});

describe("getAuditLogger", () => {
	it("should return singleton instance", () => {
		const logger1 = getAuditLogger();
		const logger2 = getAuditLogger();

		expect(logger1).toBe(logger2);
	});

	it("should return AuditLogger instance", () => {
		const logger = getAuditLogger();
		expect(logger).toBeInstanceOf(AuditLogger);
	});
});

describe("createAuditEntry", () => {
	it("should create audit entry with required fields", () => {
		const mockRequest = new Request("https://example.com", {
			headers: {
				"CF-Connecting-IP": "1.2.3.4",
				"User-Agent": "TestAgent/1.0",
			},
		});

		const entry = createAuditEntry(
			"auth",
			"login",
			"success",
			true,
			mockRequest
		);

		expect(entry.event_category).toBe("auth");
		expect(entry.event_type).toBe("login");
		expect(entry.event_action).toBe("success");
		expect(entry.severity).toBe("info");
		expect(entry.success).toBe(true);
		expect(entry.client_ip).toBe("1.2.3.4");
		expect(entry.user_agent).toBe("TestAgent/1.0");
		expect(entry.timestamp).toBeDefined();
	});

	it("should set severity to 'error' for failures", () => {
		const mockRequest = new Request("https://example.com");

		const entry = createAuditEntry(
			"auth",
			"login",
			"failure",
			false,
			mockRequest
		);

		expect(entry.severity).toBe("error");
		expect(entry.success).toBe(false);
	});

	it("should include metadata if provided", () => {
		const mockRequest = new Request("https://example.com");

		const entry = createAuditEntry(
			"api",
			"tool_execution",
			"success",
			true,
			mockRequest,
			{ tool_name: "search_contracts" }
		);

		expect(entry.metadata).toEqual({ tool_name: "search_contracts" });
	});
});
