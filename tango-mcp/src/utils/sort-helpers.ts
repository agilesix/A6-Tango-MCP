/**
 * Sort and Ordering Helpers
 *
 * Utilities for validating and parsing ordering parameters
 * for Tango API pagination and sorting.
 */

/**
 * Valid ordering fields for contracts endpoint
 */
export const VALID_CONTRACT_ORDERING_FIELDS = [
  "award_date",
  "-award_date",
  "obligated",
  "-obligated",
  "recipient_name",
  "-recipient_name",
] as const;

/**
 * Valid ordering fields for grants endpoint
 */
export const VALID_GRANT_ORDERING_FIELDS = [
  "posted_date",
  "-posted_date",
  "response_date",
  "-response_date",
  "award_amount",
  "-award_amount",
] as const;

/**
 * Valid ordering fields for opportunities endpoint
 */
export const VALID_OPPORTUNITY_ORDERING_FIELDS = [
  "posted_date",
  "-posted_date",
  "response_deadline",
  "-response_deadline",
] as const;

/**
 * Sort direction enum
 */
export type SortDirection = "asc" | "desc";

/**
 * Parsed ordering information
 */
export interface ParsedOrdering {
  /** Field name to sort by (without direction prefix) */
  field: string;
  /** Sort direction */
  direction: SortDirection;
  /** Original ordering value (with direction prefix if present) */
  raw: string;
}

/**
 * Parse ordering parameter to extract field and direction
 *
 * @param ordering Ordering parameter (e.g., "award_date", "-award_date")
 * @returns Parsed ordering information
 *
 * @example
 * parseOrdering("award_date") // { field: "award_date", direction: "asc", raw: "award_date" }
 * parseOrdering("-award_date") // { field: "award_date", direction: "desc", raw: "-award_date" }
 */
export function parseOrdering(ordering: string): ParsedOrdering {
  const isDescending = ordering.startsWith("-");
  const field = isDescending ? ordering.substring(1) : ordering;

  return {
    field,
    direction: isDescending ? "desc" : "asc",
    raw: ordering,
  };
}

/**
 * Validate ordering parameter for contracts
 *
 * @param ordering Ordering parameter to validate
 * @returns True if valid, false otherwise
 *
 * @example
 * validateContractOrdering("award_date") // true
 * validateContractOrdering("-obligated") // true
 * validateContractOrdering("invalid_field") // false
 */
export function validateContractOrdering(ordering: string): boolean {
  return VALID_CONTRACT_ORDERING_FIELDS.includes(
    ordering as (typeof VALID_CONTRACT_ORDERING_FIELDS)[number],
  );
}

/**
 * Validate ordering parameter for grants
 *
 * @param ordering Ordering parameter to validate
 * @returns True if valid, false otherwise
 */
export function validateGrantOrdering(ordering: string): boolean {
  return VALID_GRANT_ORDERING_FIELDS.includes(
    ordering as (typeof VALID_GRANT_ORDERING_FIELDS)[number],
  );
}

/**
 * Validate ordering parameter for opportunities
 *
 * @param ordering Ordering parameter to validate
 * @returns True if valid, false otherwise
 */
export function validateOpportunityOrdering(ordering: string): boolean {
  return VALID_OPPORTUNITY_ORDERING_FIELDS.includes(
    ordering as (typeof VALID_OPPORTUNITY_ORDERING_FIELDS)[number],
  );
}

/**
 * Extract cursor from pagination URL
 *
 * The Tango API returns a "next" URL that contains pagination parameters.
 * This function extracts the cursor parameter from that URL.
 *
 * @param nextUrl Next page URL from API response
 * @returns Cursor value or null if not found
 *
 * @example
 * extractCursorFromUrl("https://api.tango.com/contracts/?cursor=abc123")
 * // Returns: "abc123"
 */
export function extractCursorFromUrl(nextUrl: string | null | undefined): string | null {
  if (!nextUrl) {
    return null;
  }

  try {
    const url = new URL(nextUrl);
    return url.searchParams.get("cursor");
  } catch {
    // If URL parsing fails, try to extract cursor using regex
    const match = nextUrl.match(/[?&]cursor=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

/**
 * Build ordering description for tool responses
 *
 * Generates a human-readable description of the applied ordering.
 *
 * @param ordering Ordering parameter
 * @returns Human-readable description
 *
 * @example
 * getOrderingDescription("award_date")
 * // Returns: "Sorted by award_date (ascending)"
 *
 * getOrderingDescription("-obligated")
 * // Returns: "Sorted by obligated (descending)"
 */
export function getOrderingDescription(ordering: string): string {
  const parsed = parseOrdering(ordering);
  const direction = parsed.direction === "asc" ? "ascending" : "descending";
  return `Sorted by ${parsed.field} (${direction})`;
}

/**
 * Common ordering patterns for different use cases
 */
export const COMMON_ORDERING_PATTERNS = {
  contracts: {
    /** Most recent contracts first */
    recentFirst: "-award_date",
    /** Oldest contracts first */
    oldestFirst: "award_date",
    /** Highest value contracts first */
    highestValue: "-obligated",
    /** Lowest value contracts first */
    lowestValue: "obligated",
  },
  grants: {
    /** Most recently posted opportunities */
    recentlyPosted: "-posted_date",
    /** Nearest deadlines first */
    nearestDeadline: "response_date",
    /** Highest award amounts first */
    highestAward: "-award_amount",
  },
  opportunities: {
    /** Most recently posted opportunities */
    recentlyPosted: "-posted_date",
    /** Nearest response deadlines first */
    nearestDeadline: "response_deadline",
  },
} as const;
