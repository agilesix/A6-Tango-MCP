/**
 * Array Conversion Utilities
 *
 * Handles conversion of various array representations to pipe-delimited strings
 * for Tango API compatibility. Supports MCP JSON serialization edge cases.
 *
 * @module utils/array-helpers
 */

/**
 * Converts various array representations to pipe-delimited string
 *
 * Handles all input formats:
 * - Real arrays: ['541512', '541511'] → "541512|541511"
 * - JSON strings: '["541512","541511"]' → "541512|541511"
 * - Comma-separated: "541512, 541511" → "541512|541511"
 * - Pipe-separated: "541512|541511" → "541512|541511"
 * - Single values: "541512" → "541512"
 *
 * @param value - Array, string, or other value to convert
 * @returns Pipe-delimited string, or undefined if null/undefined
 *
 * @example
 * ```typescript
 * toPipeDelimitedString(['541512', '541511'])
 * // Returns: "541512|541511"
 *
 * toPipeDelimitedString('["541512","541511"]')
 * // Returns: "541512|541511"
 *
 * toPipeDelimitedString('541512,541511')
 * // Returns: "541512|541511"
 *
 * toPipeDelimitedString('541512|541511')
 * // Returns: "541512|541511"
 * ```
 */
export function toPipeDelimitedString(value: unknown): string | undefined {
	// Handle null/undefined
	if (value === null || value === undefined) {
		return undefined;
	}

	// Handle real arrays
	if (Array.isArray(value)) {
		const filtered = value
			.filter((item) => item !== null && item !== undefined)
			.map((item) => String(item).trim())
			.filter((item) => item.length > 0);
		return filtered.length > 0 ? filtered.join("|") : undefined;
	}

	// Handle non-string types
	if (typeof value !== "string") {
		return String(value);
	}

	// Handle strings
	const stringValue = value.trim();

	// Empty string
	if (stringValue.length === 0) {
		return undefined;
	}

	// Try to parse as JSON array (handles MCP serialization)
	if (stringValue.startsWith("[") && stringValue.endsWith("]")) {
		try {
			const parsed = JSON.parse(stringValue);
			if (Array.isArray(parsed)) {
				const filtered = parsed
					.filter((item) => item !== null && item !== undefined)
					.map((item) => String(item).trim())
					.filter((item) => item.length > 0);
				return filtered.length > 0 ? filtered.join("|") : undefined;
			}
			// Parsed successfully but not an array - fall through
		} catch {
			// JSON parse failed - treat as literal string
			// This handles edge cases like "[invalid" or "[123" (incomplete arrays)
		}
	}

	// Convert comma-separated to pipe-separated
	if (stringValue.includes(",")) {
		const filtered = stringValue
			.split(",")
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
		return filtered.length > 0 ? filtered.join("|") : undefined;
	}

	// Return as-is (already pipe-separated or single value)
	return stringValue;
}

/**
 * Validates and normalizes array values to uppercase pipe-delimited string
 *
 * Common pattern for code-based parameters (IDV types, set-aside codes)
 * that require uppercase normalization.
 *
 * @param value - Array, string, or other value to convert
 * @returns Uppercase pipe-delimited string, or undefined if null/undefined
 *
 * @example
 * ```typescript
 * toUppercasePipeString(['a', 'b'])
 * // Returns: "A|B"
 *
 * toUppercasePipeString('8a,sdvosb')
 * // Returns: "8A|SDVOSB"
 * ```
 */
export function toUppercasePipeString(value: unknown): string | undefined {
	const result = toPipeDelimitedString(value);
	return result ? result.toUpperCase() : undefined;
}

/**
 * Parses multi-value parameter and returns array of individual values
 *
 * Useful when you need to validate or process individual items
 * before converting to pipe-delimited format.
 *
 * @param value - Array, string, or other value to parse
 * @returns Array of string values, or undefined if null/undefined
 *
 * @example
 * ```typescript
 * parseMultiValueParam('["541512","541511"]')
 * // Returns: ["541512", "541511"]
 *
 * parseMultiValueParam('541512,541511')
 * // Returns: ["541512", "541511"]
 * ```
 */
export function parseMultiValueParam(value: unknown): string[] | undefined {
	const pipeString = toPipeDelimitedString(value);
	if (!pipeString) {
		return undefined;
	}
	return pipeString
		.split("|")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}
