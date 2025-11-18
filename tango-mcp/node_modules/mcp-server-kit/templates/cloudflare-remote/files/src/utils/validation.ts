/**
 * Validation Utilities (OPTIONAL)
 *
 * Reusable Zod schemas and validation helpers.
 * Use these to avoid rewriting common patterns.
 *
 * @module validation
 */

import { z } from "zod";

// =============================================================================
// Common Schemas (Reusable building blocks)
// =============================================================================

/**
 * URL validation
 *
 * @example
 * const schema = z.object({
 *   url: urlSchema.describe("API endpoint"),
 * });
 */
export const urlSchema = z.string().url();

/**
 * Email validation
 *
 * @example
 * const schema = z.object({
 *   email: emailSchema.describe("User email"),
 * });
 */
export const emailSchema = z.string().email();

/**
 * ISO 8601 datetime string
 *
 * @example
 * const schema = z.object({
 *   createdAt: datetimeSchema.describe("Creation timestamp"),
 * });
 */
export const datetimeSchema = z.string().datetime();

/**
 * Positive integer
 *
 * @example
 * const schema = z.object({
 *   count: positiveIntSchema.describe("Number of items"),
 * });
 */
export const positiveIntSchema = z.number().int().positive();

/**
 * Non-empty string
 *
 * @example
 * const schema = z.object({
 *   name: nonEmptyStringSchema.describe("User name"),
 * });
 */
export const nonEmptyStringSchema = z.string().min(1);

/**
 * UUID validation
 *
 * @example
 * const schema = z.object({
 *   id: uuidSchema.describe("Resource ID"),
 * });
 */
export const uuidSchema = z.string().uuid();

// =============================================================================
// Pagination Helpers
// =============================================================================

/**
 * Standard pagination parameters
 *
 * Returns object with page, limit, and optional offset.
 *
 * @param maxLimit - Maximum allowed limit (default: 100)
 * @param defaultLimit - Default limit if not provided (default: 10)
 * @returns Zod schema object for pagination params
 *
 * @example
 * const ListParamsSchema = z.object({
 *   query: z.string().describe("Search query"),
 *   ...paginationParams(),
 * });
 *
 * @example With custom limits
 * const ListParamsSchema = z.object({
 *   query: z.string(),
 *   ...paginationParams(50, 25), // max 50, default 25
 * });
 */
export function paginationParams(maxLimit = 100, defaultLimit = 10) {
	return {
		page: z
			.number()
			.int()
			.positive()
			.default(1)
			.describe(`Page number (default: 1)`),
		limit: z
			.number()
			.int()
			.positive()
			.max(maxLimit)
			.default(defaultLimit)
			.describe(`Items per page (max: ${maxLimit}, default: ${defaultLimit})`),
	};
}

/**
 * Offset-based pagination parameters
 *
 * Alternative to page-based pagination.
 *
 * @param maxLimit - Maximum allowed limit (default: 100)
 * @param defaultLimit - Default limit if not provided (default: 10)
 * @returns Zod schema object for offset pagination
 *
 * @example
 * const ListParamsSchema = z.object({
 *   query: z.string().describe("Search query"),
 *   ...offsetPaginationParams(),
 * });
 */
export function offsetPaginationParams(maxLimit = 100, defaultLimit = 10) {
	return {
		offset: z
			.number()
			.int()
			.nonnegative()
			.default(0)
			.describe(`Number of items to skip (default: 0)`),
		limit: z
			.number()
			.int()
			.positive()
			.max(maxLimit)
			.default(defaultLimit)
			.describe(`Items to return (max: ${maxLimit}, default: ${defaultLimit})`),
	};
}

// =============================================================================
// Date Range Validation
// =============================================================================

/**
 * Date range parameters with validation
 *
 * Ensures endDate is after startDate.
 *
 * @param required - Whether dates are required (default: false)
 * @returns Zod schema with date range validation
 *
 * @example
 * const ReportParamsSchema = z.object({
 *   ...dateRangeParams(),
 * });
 *
 * @example With required dates
 * const ReportParamsSchema = z.object({
 *   metric: z.string(),
 *   ...dateRangeParams(true),
 * });
 */
export function dateRangeParams(required = false) {
	const startSchema = required
		? datetimeSchema.describe("Start date (ISO 8601)")
		: datetimeSchema.optional().describe("Start date (ISO 8601, optional)");

	const endSchema = required
		? datetimeSchema.describe("End date (ISO 8601)")
		: datetimeSchema.optional().describe("End date (ISO 8601, optional)");

	return {
		startDate: startSchema,
		endDate: endSchema,
	};
}

/**
 * Create a date range schema with custom validation
 *
 * Use this when you need to validate that endDate > startDate.
 *
 * @param required - Whether dates are required
 * @returns Zod schema with refine validation
 *
 * @example
 * const ReportParamsSchema = createDateRangeSchema()
 *   .extend({
 *     metric: z.string(),
 *   });
 */
export function createDateRangeSchema(required = false) {
	const base = z.object(dateRangeParams(required));

	return base.refine(
		(data) => {
			if (!data.startDate || !data.endDate) return true;
			return new Date(data.endDate) > new Date(data.startDate);
		},
		{
			message: "End date must be after start date",
			path: ["endDate"],
		},
	);
}

// =============================================================================
// Sort and Filter Helpers
// =============================================================================

/**
 * Create sort parameters
 *
 * @param fields - Array of sortable field names
 * @param defaultField - Default sort field
 * @returns Zod schema object for sorting
 *
 * @example
 * const ListParamsSchema = z.object({
 *   query: z.string(),
 *   ...sortParams(["name", "date", "price"], "date"),
 * });
 */
export function sortParams<T extends string>(
	fields: readonly T[],
	defaultField?: T,
) {
	const sortBy = defaultField
		? z.enum(fields as [T, ...T[]]).default(defaultField)
		: z.enum(fields as [T, ...T[]]);

	return {
		sortBy: sortBy.describe(`Sort by field: ${fields.join(", ")}`),
		sortOrder: z
			.enum(["asc", "desc"])
			.default("asc")
			.describe("Sort order (asc or desc)"),
	};
}

// =============================================================================
// String Validation Helpers
// =============================================================================

/**
 * String with length constraints
 *
 * @param min - Minimum length
 * @param max - Maximum length
 * @returns Zod string schema
 *
 * @example
 * const schema = z.object({
 *   username: stringWithLength(3, 20).describe("Username"),
 *   bio: stringWithLength(0, 500).optional().describe("User bio"),
 * });
 */
export function stringWithLength(min: number, max: number) {
	return z.string().min(min).max(max);
}

/**
 * Alphanumeric string (letters and numbers only)
 *
 * @example
 * const schema = z.object({
 *   code: alphanumericString.describe("Alphanumeric code"),
 * });
 */
export const alphanumericString = z.string().regex(/^[a-zA-Z0-9]+$/);

/**
 * Slug format (lowercase, hyphens allowed)
 *
 * @example
 * const schema = z.object({
 *   slug: slugString.describe("URL slug"),
 * });
 */
export const slugString = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

// =============================================================================
// Enum Helpers
// =============================================================================

/**
 * Create an enum with default value
 *
 * @param values - Array of enum values
 * @param defaultValue - Default value
 * @returns Zod enum schema
 *
 * @example
 * const StatusEnum = createEnumWithDefault(
 *   ["active", "inactive", "pending"],
 *   "active"
 * );
 *
 * const schema = z.object({
 *   status: StatusEnum.describe("User status"),
 * });
 */
export function createEnumWithDefault<T extends string>(
	values: readonly T[],
	defaultValue: T,
) {
	return z.enum(values as [T, ...T[]]).default(defaultValue);
}

// =============================================================================
// Array Validation
// =============================================================================

/**
 * Array with size constraints
 *
 * @param itemSchema - Schema for array items
 * @param minItems - Minimum number of items
 * @param maxItems - Maximum number of items
 * @returns Zod array schema
 *
 * @example
 * const schema = z.object({
 *   tags: arrayWithSize(z.string(), 1, 10).describe("Tags (1-10)"),
 *   ids: arrayWithSize(uuidSchema, 1, 100).describe("Item IDs"),
 * });
 */
export function arrayWithSize<T extends z.ZodTypeAny>(
	itemSchema: T,
	minItems: number,
	maxItems: number,
) {
	return z.array(itemSchema).min(minItems).max(maxItems);
}

// =============================================================================
// Conditional Validation
// =============================================================================

/**
 * Make fields required based on another field's value
 *
 * @example
 * const schema = z.object({
 *   type: z.enum(["user", "service"]),
 *   email: z.string().email().optional(),
 *   apiKey: z.string().optional(),
 * }).refine(
 *   (data) => {
 *     if (data.type === "user") return !!data.email;
 *     if (data.type === "service") return !!data.apiKey;
 *     return true;
 *   },
 *   {
 *     message: "Email required for user type, API key for service type",
 *   }
 * );
 */

// =============================================================================
// Type Utilities
// =============================================================================

/**
 * Extract inferred type from Zod schema
 *
 * @example
 * const UserSchema = z.object({
 *   id: uuidSchema,
 *   name: nonEmptyStringSchema,
 * });
 *
 * type User = InferZodType<typeof UserSchema>;
 * // { id: string; name: string; }
 */
export type InferZodType<T extends z.ZodTypeAny> = z.infer<T>;

// =============================================================================
// Usage Examples
// =============================================================================

/**
 * EXAMPLE 1: List endpoint with pagination and sorting
 *
 * const ListUsersParamsSchema = z.object({
 *   query: z.string().optional().describe("Search query"),
 *   ...paginationParams(50, 10),
 *   ...sortParams(["name", "email", "createdAt"], "createdAt"),
 * });
 */

/**
 * EXAMPLE 2: Date range report
 *
 * const ReportParamsSchema = createDateRangeSchema(true).extend({
 *   metric: z.enum(["views", "clicks", "conversions"]),
 *   ...paginationParams(),
 * });
 */

/**
 * EXAMPLE 3: Create resource with validation
 *
 * const CreateUserParamsSchema = z.object({
 *   email: emailSchema.describe("User email"),
 *   name: stringWithLength(2, 100).describe("Full name"),
 *   bio: stringWithLength(0, 500).optional().describe("Bio"),
 *   tags: arrayWithSize(slugString, 0, 10).optional(),
 * });
 */

/**
 * EXAMPLE 4: Without helpers (raw approach)
 *
 * const ManualSchema = z.object({
 *   page: z.number().int().positive().default(1),
 *   limit: z.number().int().positive().max(100).default(10),
 *   sortBy: z.enum(["name", "date"]).default("date"),
 *   sortOrder: z.enum(["asc", "desc"]).default("asc"),
 * });
 */
