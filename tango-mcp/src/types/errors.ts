/**
 * Structured Error Types for Tango MCP Server
 *
 * Agent-optimized error handling with:
 * - Specific error codes for programmatic handling
 * - Recovery suggestions for agents to act on
 * - Recoverable/transient flags for retry logic
 * - Context information for debugging
 *
 * Design principle: Errors should guide agents to successful recovery
 */

/**
 * Base error response structure
 * All error responses follow this format for consistency
 */
export interface ErrorResponse {
  /** Human-readable error message */
  error: string;

  /** Machine-readable error code */
  error_code: string;

  /** Actionable suggestion for recovery */
  suggestion: string;

  /** Whether the error can be recovered from */
  recoverable: boolean;

  /** Whether the error is transient (may succeed on retry) */
  transient: boolean;

  /** Additional context (parameter name, expected format, etc.) */
  context?: Record<string, unknown>;
}

/**
 * Tango API authentication error
 * Occurs when API key is missing or invalid
 */
export class TangoAuthenticationError extends Error {
  readonly errorCode = "AUTHENTICATION_ERROR";
  readonly recoverable = true;
  readonly transient = false;

  constructor(message = "Tango API key required") {
    super(message);
    this.name = "TangoAuthenticationError";
  }

  toErrorResponse(): ErrorResponse {
    return {
      error: this.message,
      error_code: this.errorCode,
      suggestion:
        "Provide api_key parameter or ensure TANGO_API_KEY environment variable is set. Obtain an API key from https://tango.makegov.com",
      recoverable: this.recoverable,
      transient: this.transient,
    };
  }
}

/**
 * Validation error for invalid input parameters
 * Occurs when parameter format or value is invalid
 */
export class TangoValidationError extends Error {
  readonly errorCode = "VALIDATION_ERROR";
  readonly recoverable = true;
  readonly transient = false;

  constructor(
    message: string,
    public readonly parameter?: string,
    public readonly provided?: unknown,
    public readonly expectedFormat?: string,
    public readonly example?: string,
  ) {
    super(message);
    this.name = "TangoValidationError";
  }

  toErrorResponse(): ErrorResponse {
    const context: Record<string, unknown> = {};

    if (this.parameter) context.parameter = this.parameter;
    if (this.provided !== undefined) context.provided = this.provided;
    if (this.expectedFormat) context.expected_format = this.expectedFormat;
    if (this.example) context.example = this.example;

    let suggestion = "Check parameter format and try again. ";
    if (this.expectedFormat) {
      suggestion += `Expected format: ${this.expectedFormat}. `;
    }
    if (this.example) {
      suggestion += `Example: ${this.example}`;
    }

    return {
      error: this.message,
      error_code: this.errorCode,
      suggestion,
      recoverable: this.recoverable,
      transient: this.transient,
      context,
    };
  }
}

/**
 * API error from Tango service
 * Occurs when Tango API returns error response
 */
export class TangoApiError extends Error {
  readonly errorCode = "API_ERROR";
  readonly recoverable: boolean;
  readonly transient: boolean;

  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "TangoApiError";

    // Rate limit errors are transient and recoverable
    this.transient = statusCode === 429 || statusCode === 503;
    this.recoverable = this.transient || (statusCode ? statusCode >= 500 : false);
  }

  toErrorResponse(): ErrorResponse {
    const context: Record<string, unknown> = {};

    if (this.statusCode) context.status_code = this.statusCode;
    if (this.retryAfterMs) context.retry_after_ms = this.retryAfterMs;

    let suggestion = "";

    if (this.statusCode === 429) {
      suggestion = `Rate limit exceeded. Wait ${this.retryAfterMs || 1000}ms and retry the request.`;
    } else if (this.statusCode === 503) {
      suggestion = "Tango API is temporarily unavailable. Retry in a few moments.";
    } else if (this.statusCode && this.statusCode >= 500) {
      suggestion = "Tango API encountered a server error. Retry the request.";
    } else if (this.statusCode === 404) {
      suggestion = "Resource not found. Check the identifier (UEI, contract ID, etc.) and try again.";
    } else if (this.statusCode === 400) {
      suggestion = "Invalid request parameters. Check parameter formats and values.";
    } else {
      suggestion = "Check request parameters and retry.";
    }

    return {
      error: this.message,
      error_code: this.errorCode,
      suggestion,
      recoverable: this.recoverable,
      transient: this.transient,
      context,
    };
  }
}

/**
 * Network error during API communication
 * Occurs when network request fails (timeout, connection error, etc.)
 */
export class TangoNetworkError extends Error {
  readonly errorCode = "NETWORK_ERROR";
  readonly recoverable = true;
  readonly transient = true;

  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TangoNetworkError";
  }

  toErrorResponse(): ErrorResponse {
    const context: Record<string, unknown> = {};

    if (this.cause) {
      context.cause = String(this.cause);
    }

    return {
      error: this.message,
      error_code: this.errorCode,
      suggestion:
        "Network request failed. Check internet connectivity and retry. If problem persists, Tango API may be unreachable.",
      recoverable: this.recoverable,
      transient: this.transient,
      context,
    };
  }
}

/**
 * Timeout error when request takes too long
 * Occurs when API call exceeds 30-second timeout
 */
export class TangoTimeoutError extends Error {
  readonly errorCode = "TIMEOUT";
  readonly recoverable = true;
  readonly transient = true;

  constructor(
    message = "Request timeout after 30 seconds",
    public readonly durationMs = 30000,
  ) {
    super(message);
    this.name = "TangoTimeoutError";
  }

  toErrorResponse(): ErrorResponse {
    return {
      error: this.message,
      error_code: this.errorCode,
      suggestion:
        "Request took too long. Try reducing the limit parameter or adding more specific filters to narrow the search.",
      recoverable: this.recoverable,
      transient: this.transient,
      context: {
        timeout_ms: this.durationMs,
      },
    };
  }
}

/**
 * Helper to create error response from any error
 *
 * @param error Error object (can be TangoError or generic Error)
 * @returns Structured error response
 */
export function toErrorResponse(error: unknown): ErrorResponse {
  // Handle Tango error types
  if (error instanceof TangoAuthenticationError) {
    return error.toErrorResponse();
  }
  if (error instanceof TangoValidationError) {
    return error.toErrorResponse();
  }
  if (error instanceof TangoApiError) {
    return error.toErrorResponse();
  }
  if (error instanceof TangoNetworkError) {
    return error.toErrorResponse();
  }
  if (error instanceof TangoTimeoutError) {
    return error.toErrorResponse();
  }

  // Handle generic errors
  if (error instanceof Error) {
    return {
      error: error.message,
      error_code: "UNKNOWN_ERROR",
      suggestion: "An unexpected error occurred. Check logs for details.",
      recoverable: false,
      transient: false,
      context: {
        error_name: error.name,
      },
    };
  }

  // Handle non-Error objects
  return {
    error: String(error),
    error_code: "UNKNOWN_ERROR",
    suggestion: "An unexpected error occurred. Check logs for details.",
    recoverable: false,
    transient: false,
  };
}
