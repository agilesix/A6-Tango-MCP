/**
 * Structured Logging Utility
 *
 * Provides JSON-formatted logging for Cloudflare Workers environment.
 * Logs tool invocations, API calls, cache operations, and errors with full context.
 *
 * Usage:
 *   const logger = createLogger();
 *   logger.info('Tool invoked', { tool: 'search_contracts', params: {...} });
 *   logger.error('API call failed', { endpoint: '/contracts', error: err });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
	[key: string]: unknown;
}

export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
	context?: LogContext;
	error?: {
		message: string;
		stack?: string;
		code?: string;
	};
}

export interface Logger {
	debug(message: string, context?: LogContext): void;
	info(message: string, context?: LogContext): void;
	warn(message: string, context?: LogContext): void;
	error(message: string, error?: Error, context?: LogContext): void;
	toolInvocation(
		toolName: string,
		params: unknown,
		startTime: number
	): void;
	toolComplete(
		toolName: string,
		success: boolean,
		duration: number,
		context?: LogContext
	): void;
	apiCall(
		endpoint: string,
		method: string,
		status: number,
		duration: number
	): void;
	cacheOperation(
		operation: "hit" | "miss" | "set",
		key: string,
		context?: LogContext
	): void;
}

/**
 * Create a structured logger instance
 *
 * @param minLevel - Minimum log level to output (default: "info")
 * @returns Logger instance
 */
export function createLogger(minLevel: LogLevel = "info"): Logger {
	const levels: Record<LogLevel, number> = {
		debug: 0,
		info: 1,
		warn: 2,
		error: 3,
	};

	const minLevelValue = levels[minLevel];

	function shouldLog(level: LogLevel): boolean {
		return levels[level] >= minLevelValue;
	}

	function formatLogEntry(
		level: LogLevel,
		message: string,
		context?: LogContext,
		error?: Error
	): LogEntry {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			message,
		};

		if (context && Object.keys(context).length > 0) {
			entry.context = context;
		}

		if (error) {
			entry.error = {
				message: error.message,
				stack: error.stack,
				code: (error as any).code,
			};
		}

		return entry;
	}

	function log(
		level: LogLevel,
		message: string,
		context?: LogContext,
		error?: Error
	): void {
		if (!shouldLog(level)) {
			return;
		}

		const entry = formatLogEntry(level, message, context, error);
		const output = JSON.stringify(entry);

		// Use appropriate console method for Cloudflare Workers
		if (level === "error") {
			console.error(output);
		} else if (level === "warn") {
			console.warn(output);
		} else {
			console.log(output);
		}
	}

	return {
		debug(message: string, context?: LogContext): void {
			log("debug", message, context);
		},

		info(message: string, context?: LogContext): void {
			log("info", message, context);
		},

		warn(message: string, context?: LogContext): void {
			log("warn", message, context);
		},

		error(message: string, error?: Error, context?: LogContext): void {
			log("error", message, context, error);
		},

		toolInvocation(
			toolName: string,
			params: unknown,
			startTime: number
		): void {
			log("info", "Tool invoked", {
				tool: toolName,
				params,
				timestamp: startTime,
			});
		},

		toolComplete(
			toolName: string,
			success: boolean,
			duration: number,
			context?: LogContext
		): void {
			log(success ? "info" : "warn", "Tool completed", {
				tool: toolName,
				success,
				duration_ms: duration,
				...context,
			});
		},

		apiCall(
			endpoint: string,
			method: string,
			status: number,
			duration: number
		): void {
			const level = status >= 400 ? "warn" : "info";
			log(level, "API call", {
				endpoint,
				method,
				status,
				duration_ms: duration,
			});
		},

		cacheOperation(
			operation: "hit" | "miss" | "set",
			key: string,
			context?: LogContext
		): void {
			log("debug", `Cache ${operation}`, {
				operation,
				cache_key: key,
				...context,
			});
		},
	};
}

/**
 * Redact sensitive information from log context
 *
 * @param context - Log context that may contain sensitive data
 * @returns Redacted context safe for logging
 */
export function redactSensitive(context: LogContext): LogContext {
	const sensitive = ["api_key", "apiKey", "password", "token", "secret"];
	const redacted: LogContext = {};

	for (const [key, value] of Object.entries(context)) {
		if (sensitive.some((s) => key.toLowerCase().includes(s))) {
			redacted[key] = "[REDACTED]";
		} else if (typeof value === "object" && value !== null) {
			redacted[key] = redactSensitive(value as LogContext);
		} else {
			redacted[key] = value;
		}
	}

	return redacted;
}

/**
 * Create a performance measurement logger
 *
 * @param logger - Logger instance
 * @param operation - Operation name
 * @returns Function to end measurement and log
 */
export function createPerformanceLogger(
	logger: Logger,
	operation: string
): () => void {
	const startTime = Date.now();

	return () => {
		const duration = Date.now() - startTime;
		logger.debug("Performance measurement", {
			operation,
			duration_ms: duration,
		});
	};
}

/**
 * Global logger instance (lazy initialization)
 */
let globalLogger: Logger | null = null;

/**
 * Get or create the global logger instance
 *
 * @param minLevel - Minimum log level (only used on first call)
 * @returns Global logger instance
 */
export function getLogger(minLevel: LogLevel = "info"): Logger {
	if (!globalLogger) {
		globalLogger = createLogger(minLevel);
	}
	return globalLogger;
}

/**
 * Reset the global logger (useful for testing)
 */
export function resetLogger(): void {
	globalLogger = null;
}
