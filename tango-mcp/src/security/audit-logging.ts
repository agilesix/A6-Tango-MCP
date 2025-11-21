/**
 * Audit Logging Module for Tango MCP Server
 *
 * Provides structured JSON logging for security-relevant events:
 * - Authentication attempts (success and failure)
 * - User identity logging (email for OAuth, tokenId for MCP token)
 * - Tool usage with user context
 * - Security events
 *
 * SECURITY: Does not log sensitive data (no API keys, no full tokens)
 */

/**
 * Event categories for audit logging
 */
export type AuditEventCategory =
	| "auth" // Authentication events
	| "authz" // Authorization events
	| "oauth" // OAuth flow events
	| "api" // API calls
	| "security" // Security-specific events
	| "error"; // Error events

/**
 * Event severity levels
 */
export type AuditSeverity = "info" | "warning" | "error" | "critical";

/**
 * Structured audit log entry
 */
export interface AuditLogEntry {
	/** ISO 8601 timestamp */
	timestamp: string;

	/** Event classification */
	event_category: AuditEventCategory;
	event_type: string; // e.g., "login", "token_validation", "tool_execution"
	event_action: string; // e.g., "attempt", "success", "failure"
	severity: AuditSeverity;

	/** Actor information */
	user_id?: string; // User ID or email
	user_email?: string; // User email (OAuth)
	user_name?: string; // User name (OAuth)
	token_id?: string; // Truncated token ID (MCP tokens)
	client_ip: string;
	user_agent: string;
	session_id?: string;

	/** Resource information */
	resource_type?: string; // e.g., "tool", "endpoint", "api"
	resource_id?: string; // e.g., tool name, endpoint path

	/** Result */
	success: boolean;
	error_code?: string;
	error_message?: string;

	/** Additional context */
	metadata?: Record<string, unknown>;

	/** Correlation for distributed tracing */
	trace_id?: string;
	parent_trace_id?: string;
}

/**
 * Audit logger class
 */
export class AuditLogger {
	/**
	 * Log an audit event
	 *
	 * @param entry - Audit log entry
	 */
	async log(entry: AuditLogEntry): Promise<void> {
		// Structured JSON logging to console
		// In production, this will be captured by Cloudflare Workers Logs
		// and can be forwarded to external logging services (Datadog, Splunk, etc.)
		console.log("[AUDIT]", JSON.stringify(entry));

		// Future: Could also write to Analytics Engine, KV, or external SIEM
	}

	/**
	 * Log authentication attempt
	 *
	 * @param success - Whether authentication succeeded
	 * @param method - Authentication method used
	 * @param userInfo - User information
	 * @param request - Request object
	 * @param errorMessage - Error message if failed
	 */
	async logAuthAttempt(
		success: boolean,
		method: "oauth" | "mcp-token" | "none",
		userInfo: {
			email?: string;
			name?: string;
			tokenId?: string;
		},
		request: Request,
		errorMessage?: string
	): Promise<void> {
		await this.log({
			timestamp: new Date().toISOString(),
			event_category: "auth",
			event_type: "authentication",
			event_action: success ? "success" : "failure",
			severity: success ? "info" : "warning",
			user_email: userInfo.email,
			user_name: userInfo.name,
			token_id: userInfo.tokenId ? this.truncateToken(userInfo.tokenId) : undefined,
			client_ip: this.getClientIP(request),
			user_agent: request.headers.get("User-Agent") || "unknown",
			success,
			error_message: errorMessage,
			metadata: {
				auth_method: method,
			},
		});
	}

	/**
	 * Log OAuth callback event
	 *
	 * @param success - Whether callback succeeded
	 * @param email - User email
	 * @param request - Request object
	 * @param errorMessage - Error message if failed
	 */
	async logOAuthCallback(
		success: boolean,
		email: string | undefined,
		request: Request,
		errorMessage?: string
	): Promise<void> {
		await this.log({
			timestamp: new Date().toISOString(),
			event_category: "oauth",
			event_type: "oauth_callback",
			event_action: success ? "success" : "failure",
			severity: success ? "info" : "error",
			user_email: email,
			client_ip: this.getClientIP(request),
			user_agent: request.headers.get("User-Agent") || "unknown",
			success,
			error_message: errorMessage,
			metadata: {
				oauth_provider: "google",
			},
		});
	}

	/**
	 * Log token validation event
	 *
	 * @param success - Whether validation succeeded
	 * @param tokenId - Truncated token ID
	 * @param userId - User ID associated with token
	 * @param request - Request object
	 * @param errorMessage - Error message if failed
	 */
	async logTokenValidation(
		success: boolean,
		tokenId: string,
		userId: string | undefined,
		request: Request,
		errorMessage?: string
	): Promise<void> {
		await this.log({
			timestamp: new Date().toISOString(),
			event_category: "auth",
			event_type: "token_validation",
			event_action: success ? "success" : "failure",
			severity: success ? "info" : "warning",
			token_id: this.truncateToken(tokenId),
			user_id: userId,
			client_ip: this.getClientIP(request),
			user_agent: request.headers.get("User-Agent") || "unknown",
			success,
			error_message: errorMessage,
		});
	}

	/**
	 * Log tool execution event
	 *
	 * @param toolName - Name of the tool executed
	 * @param userInfo - User information
	 * @param request - Request object
	 * @param success - Whether execution succeeded
	 * @param errorMessage - Error message if failed
	 */
	async logToolExecution(
		toolName: string,
		userInfo: {
			email?: string;
			name?: string;
			tokenId?: string;
		},
		request: Request,
		success: boolean,
		errorMessage?: string
	): Promise<void> {
		await this.log({
			timestamp: new Date().toISOString(),
			event_category: "api",
			event_type: "tool_execution",
			event_action: success ? "success" : "failure",
			severity: success ? "info" : "error",
			user_email: userInfo.email,
			user_name: userInfo.name,
			token_id: userInfo.tokenId ? this.truncateToken(userInfo.tokenId) : undefined,
			client_ip: this.getClientIP(request),
			user_agent: request.headers.get("User-Agent") || "unknown",
			resource_type: "tool",
			resource_id: toolName,
			success,
			error_message: errorMessage,
		});
	}

	/**
	 * Log security event (rate limit violation, suspicious activity, etc.)
	 *
	 * @param eventType - Type of security event
	 * @param severity - Severity level
	 * @param request - Request object
	 * @param details - Additional details
	 */
	async logSecurityEvent(
		eventType: string,
		severity: AuditSeverity,
		request: Request,
		details: Record<string, unknown>
	): Promise<void> {
		await this.log({
			timestamp: new Date().toISOString(),
			event_category: "security",
			event_type: eventType,
			event_action: "detected",
			severity,
			client_ip: this.getClientIP(request),
			user_agent: request.headers.get("User-Agent") || "unknown",
			success: false,
			metadata: details,
		});
	}

	/**
	 * Log rate limit violation
	 *
	 * @param limitType - Type of rate limit
	 * @param key - Rate limit key (IP, user ID, etc.)
	 * @param request - Request object
	 * @param currentCount - Current request count
	 * @param limit - Rate limit threshold
	 */
	async logRateLimitViolation(
		limitType: string,
		key: string,
		request: Request,
		currentCount: number,
		limit: number
	): Promise<void> {
		await this.logSecurityEvent(
			"rate_limit_exceeded",
			"warning",
			request,
			{
				limit_type: limitType,
				rate_limit_key: this.sanitizeKey(key),
				current_count: currentCount,
				limit,
			}
		);
	}

	/**
	 * Log OAuth state validation failure
	 *
	 * @param reason - Reason for failure
	 * @param request - Request object
	 */
	async logOAuthStateFailure(reason: string, request: Request): Promise<void> {
		await this.logSecurityEvent(
			"oauth_state_validation_failed",
			"warning",
			request,
			{
				failure_reason: reason,
			}
		);
	}

	/**
	 * Log CSRF token validation failure
	 *
	 * @param request - Request object
	 */
	async logCSRFFailure(request: Request): Promise<void> {
		await this.logSecurityEvent(
			"csrf_validation_failed",
			"warning",
			request,
			{
				failure_reason: "CSRF token mismatch",
			}
		);
	}

	/**
	 * Truncate token for logging (show only first 8 characters)
	 * SECURITY: Never log full tokens
	 *
	 * @param token - Full token
	 * @returns Truncated token for logging
	 */
	private truncateToken(token: string): string {
		if (token.length <= 8) {
			return token;
		}
		return `${token.substring(0, 8)}...`;
	}

	/**
	 * Sanitize rate limit key for logging
	 * Remove sensitive parts while keeping enough for debugging
	 *
	 * @param key - Rate limit key
	 * @returns Sanitized key
	 */
	private sanitizeKey(key: string): string {
		// If it's an email, mask the username part
		if (key.includes("@")) {
			const [username, domain] = key.split("@");
			const maskedUsername =
				username.length > 3
					? `${username.substring(0, 2)}***${username.substring(username.length - 1)}`
					: "***";
			return `${maskedUsername}@${domain}`;
		}

		// If it's an IP, mask the last octet
		if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(key)) {
			const parts = key.split(".");
			return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
		}

		// For other keys, show first 8 chars
		return this.truncateToken(key);
	}

	/**
	 * Extract client IP from request
	 *
	 * @param request - Request object
	 * @returns Client IP address
	 */
	private getClientIP(request: Request): string {
		// Try Cloudflare's CF-Connecting-IP header first
		const cfIP = request.headers.get("CF-Connecting-IP");
		if (cfIP) return cfIP;

		// Fallback to X-Forwarded-For
		const forwardedFor = request.headers.get("X-Forwarded-For");
		if (forwardedFor) {
			const ips = forwardedFor.split(",").map((ip) => ip.trim());
			return ips[0];
		}

		// Last resort: X-Real-IP
		const realIP = request.headers.get("X-Real-IP");
		if (realIP) return realIP;

		return "unknown";
	}
}

/**
 * Create a singleton audit logger instance
 */
let auditLoggerInstance: AuditLogger | null = null;

/**
 * Get the audit logger instance (singleton)
 *
 * @returns Audit logger instance
 */
export function getAuditLogger(): AuditLogger {
	if (!auditLoggerInstance) {
		auditLoggerInstance = new AuditLogger();
	}
	return auditLoggerInstance;
}

/**
 * Helper function to create audit log entry
 *
 * @param category - Event category
 * @param type - Event type
 * @param action - Event action
 * @param success - Whether the event succeeded
 * @param request - Request object
 * @param metadata - Additional metadata
 * @returns Audit log entry
 */
export function createAuditEntry(
	category: AuditEventCategory,
	type: string,
	action: string,
	success: boolean,
	request: Request,
	metadata?: Record<string, unknown>
): AuditLogEntry {
	const logger = getAuditLogger();
	return {
		timestamp: new Date().toISOString(),
		event_category: category,
		event_type: type,
		event_action: action,
		severity: success ? "info" : "error",
		client_ip: request.headers.get("CF-Connecting-IP") || "unknown",
		user_agent: request.headers.get("User-Agent") || "unknown",
		success,
		metadata,
	};
}
