/**
 * Input Sanitization Middleware
 *
 * Recursively sanitizes user input to prevent injection attacks and ensure data quality.
 * Strips control characters, trims strings, and handles nested objects/arrays.
 *
 * @module middleware/sanitization
 */

/**
 * Sanitizes a single string value
 * - Strips control characters (0x00-0x1F, 0x7F-0x9F)
 * - Trims leading/trailing whitespace
 * - Preserves empty strings
 *
 * @param value - String to sanitize
 * @returns Sanitized string
 *
 * @example
 * sanitizeString("  hello\x00world  ") // "helloworld"
 * sanitizeString("\n\ttest\r\n") // "test"
 */
export function sanitizeString(value: string): string {
	// Strip control characters (ASCII 0x00-0x1F and 0x7F-0x9F)
	// But preserve common whitespace (space, tab, newline, carriage return)
	// biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally checking for control characters
	const stripped = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

	// Trim leading/trailing whitespace
	return stripped.trim();
}

/**
 * Recursively sanitizes input data
 * Handles:
 * - Strings: strips control chars and trims
 * - Objects: recursively sanitizes all values
 * - Arrays: recursively sanitizes all elements
 * - Other types: passed through unchanged (numbers, booleans, null, undefined)
 *
 * @param input - Data to sanitize (any type)
 * @returns Sanitized data with same structure
 *
 * @example
 * sanitizeInput({ name: "  test\x00  ", count: 5 })
 * // { name: "test", count: 5 }
 *
 * @example
 * sanitizeInput(["  hello  ", "  world\x00  "])
 * // ["hello", "world"]
 *
 * @example
 * sanitizeInput({ items: [{ id: "\x00123", val: "  test  " }] })
 * // { items: [{ id: "123", val: "test" }] }
 */
export function sanitizeInput<T>(input: T): T {
	// Handle null and undefined
	if (input === null || input === undefined) {
		return input;
	}

	// Handle strings
	if (typeof input === 'string') {
		return sanitizeString(input) as unknown as T;
	}

	// Handle arrays
	if (Array.isArray(input)) {
		return input.map(item => sanitizeInput(item)) as unknown as T;
	}

	// Handle objects (but not Date, RegExp, etc)
	if (typeof input === 'object' && input.constructor === Object) {
		const sanitized: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(input)) {
			sanitized[key] = sanitizeInput(value);
		}
		return sanitized as T;
	}

	// Pass through other types unchanged (numbers, booleans, Date, etc)
	return input;
}

/**
 * Type guard to check if input is a plain object
 *
 * @param value - Value to check
 * @returns True if value is a plain object
 *
 * @example
 * isPlainObject({}) // true
 * isPlainObject([]) // false
 * isPlainObject(new Date()) // false
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		value.constructor === Object
	);
}

/**
 * Validates that a string contains no control characters
 *
 * @param value - String to validate
 * @returns True if string contains control characters
 *
 * @example
 * hasControlCharacters("hello") // false
 * hasControlCharacters("hello\x00world") // true
 */
export function hasControlCharacters(value: string): boolean {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally checking for control characters
	return /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/.test(value);
}

/**
 * Validates and sanitizes tool arguments
 * Ensures all string inputs are safe before processing
 *
 * @param args - Tool arguments to sanitize
 * @returns Sanitized arguments
 *
 * @example
 * sanitizeToolArgs({ query: "  test\x00  ", limit: 10 })
 * // { query: "test", limit: 10 }
 */
export function sanitizeToolArgs<T extends Record<string, unknown>>(args: T): T {
	return sanitizeInput(args);
}

/**
 * Middleware wrapper for tool handlers
 * Automatically sanitizes input before calling the tool
 *
 * @param handler - Original tool handler function
 * @returns Wrapped handler with sanitization
 *
 * @example
 * const safeTool = withSanitization(async (args) => {
 *   // args are already sanitized here
 *   return { result: args.query };
 * });
 */
export function withSanitization<TArgs extends Record<string, unknown>, TResult>(
	handler: (args: TArgs, env: Env) => Promise<TResult>
): (args: TArgs, env: Env) => Promise<TResult> {
	return async (args: TArgs, env: Env): Promise<TResult> => {
		const sanitized = sanitizeToolArgs(args);
		return handler(sanitized, env);
	};
}
