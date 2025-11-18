/**
 * Unit tests for sort-helpers utility
 */

import { describe, it, expect } from "vitest";
import {
  parseOrdering,
  validateContractOrdering,
  validateGrantOrdering,
  validateOpportunityOrdering,
  extractCursorFromUrl,
  getOrderingDescription,
  COMMON_ORDERING_PATTERNS,
} from "@/utils/sort-helpers";

describe("parseOrdering", () => {
  it("should parse ascending ordering", () => {
    const result = parseOrdering("award_date");
    expect(result).toEqual({
      field: "award_date",
      direction: "asc",
      raw: "award_date",
    });
  });

  it("should parse descending ordering", () => {
    const result = parseOrdering("-award_date");
    expect(result).toEqual({
      field: "award_date",
      direction: "desc",
      raw: "-award_date",
    });
  });

  it("should handle multiple dashes", () => {
    const result = parseOrdering("-obligated");
    expect(result.field).toBe("obligated");
    expect(result.direction).toBe("desc");
  });
});

describe("validateContractOrdering", () => {
  it("should accept valid ascending fields", () => {
    expect(validateContractOrdering("award_date")).toBe(true);
    expect(validateContractOrdering("obligated")).toBe(true);
    expect(validateContractOrdering("recipient_name")).toBe(true);
  });

  it("should accept valid descending fields", () => {
    expect(validateContractOrdering("-award_date")).toBe(true);
    expect(validateContractOrdering("-obligated")).toBe(true);
    expect(validateContractOrdering("-recipient_name")).toBe(true);
  });

  it("should reject invalid fields", () => {
    expect(validateContractOrdering("invalid_field")).toBe(false);
    expect(validateContractOrdering("-invalid_field")).toBe(false);
    expect(validateContractOrdering("")).toBe(false);
  });
});

describe("validateGrantOrdering", () => {
  it("should accept valid grant fields", () => {
    expect(validateGrantOrdering("posted_date")).toBe(true);
    expect(validateGrantOrdering("-response_date")).toBe(true);
    expect(validateGrantOrdering("award_amount")).toBe(true);
  });

  it("should reject contract-specific fields", () => {
    expect(validateGrantOrdering("obligated")).toBe(false);
    expect(validateGrantOrdering("recipient_name")).toBe(false);
  });

  it("should reject invalid fields", () => {
    expect(validateGrantOrdering("invalid_field")).toBe(false);
  });
});

describe("validateOpportunityOrdering", () => {
  it("should accept valid opportunity fields", () => {
    expect(validateOpportunityOrdering("posted_date")).toBe(true);
    expect(validateOpportunityOrdering("-posted_date")).toBe(true);
    expect(validateOpportunityOrdering("response_deadline")).toBe(true);
    expect(validateOpportunityOrdering("-response_deadline")).toBe(true);
  });

  it("should reject invalid fields", () => {
    expect(validateOpportunityOrdering("award_amount")).toBe(false);
    expect(validateOpportunityOrdering("obligated")).toBe(false);
    expect(validateOpportunityOrdering("invalid_field")).toBe(false);
  });
});

describe("extractCursorFromUrl", () => {
  it("should extract cursor from valid URL", () => {
    const url = "https://api.tango.com/contracts/?cursor=abc123&limit=10";
    expect(extractCursorFromUrl(url)).toBe("abc123");
  });

  it("should extract URL-encoded cursor", () => {
    const url = "https://api.tango.com/contracts/?cursor=Y3JlYXRlZD0yMDI0LTAxLTE1VDE1OjMwOjAwLjAwMFo%3D";
    expect(extractCursorFromUrl(url)).toBe("Y3JlYXRlZD0yMDI0LTAxLTE1VDE1OjMwOjAwLjAwMFo=");
  });

  it("should handle cursor as first parameter", () => {
    const url = "https://api.tango.com/contracts/?cursor=xyz789";
    expect(extractCursorFromUrl(url)).toBe("xyz789");
  });

  it("should handle cursor as middle parameter", () => {
    const url = "https://api.tango.com/contracts/?limit=10&cursor=xyz789&ordering=-award_date";
    expect(extractCursorFromUrl(url)).toBe("xyz789");
  });

  it("should return null for URL without cursor", () => {
    const url = "https://api.tango.com/contracts/?limit=10";
    expect(extractCursorFromUrl(url)).toBeNull();
  });

  it("should return null for null input", () => {
    expect(extractCursorFromUrl(null)).toBeNull();
  });

  it("should return null for undefined input", () => {
    expect(extractCursorFromUrl(undefined)).toBeNull();
  });

  it("should handle malformed URLs gracefully", () => {
    const url = "not-a-valid-url?cursor=abc123";
    const result = extractCursorFromUrl(url);
    expect(result).toBe("abc123");
  });
});

describe("getOrderingDescription", () => {
  it("should describe ascending ordering", () => {
    expect(getOrderingDescription("award_date")).toBe("Sorted by award_date (ascending)");
  });

  it("should describe descending ordering", () => {
    expect(getOrderingDescription("-award_date")).toBe("Sorted by award_date (descending)");
  });

  it("should handle different field names", () => {
    expect(getOrderingDescription("-obligated")).toBe("Sorted by obligated (descending)");
    expect(getOrderingDescription("posted_date")).toBe("Sorted by posted_date (ascending)");
  });
});

describe("COMMON_ORDERING_PATTERNS", () => {
  it("should have contract patterns", () => {
    expect(COMMON_ORDERING_PATTERNS.contracts.recentFirst).toBe("-award_date");
    expect(COMMON_ORDERING_PATTERNS.contracts.oldestFirst).toBe("award_date");
    expect(COMMON_ORDERING_PATTERNS.contracts.highestValue).toBe("-obligated");
    expect(COMMON_ORDERING_PATTERNS.contracts.lowestValue).toBe("obligated");
  });

  it("should have grant patterns", () => {
    expect(COMMON_ORDERING_PATTERNS.grants.recentlyPosted).toBe("-posted_date");
    expect(COMMON_ORDERING_PATTERNS.grants.nearestDeadline).toBe("response_date");
    expect(COMMON_ORDERING_PATTERNS.grants.highestAward).toBe("-award_amount");
  });

  it("should have opportunity patterns", () => {
    expect(COMMON_ORDERING_PATTERNS.opportunities.recentlyPosted).toBe("-posted_date");
    expect(COMMON_ORDERING_PATTERNS.opportunities.nearestDeadline).toBe("response_deadline");
  });

  it("should have valid ordering values", () => {
    // Verify all pattern values are valid
    expect(validateContractOrdering(COMMON_ORDERING_PATTERNS.contracts.recentFirst)).toBe(true);
    expect(validateContractOrdering(COMMON_ORDERING_PATTERNS.contracts.highestValue)).toBe(true);
    expect(validateGrantOrdering(COMMON_ORDERING_PATTERNS.grants.recentlyPosted)).toBe(true);
    expect(validateGrantOrdering(COMMON_ORDERING_PATTERNS.grants.nearestDeadline)).toBe(true);
    expect(validateOpportunityOrdering(COMMON_ORDERING_PATTERNS.opportunities.recentlyPosted)).toBe(true);
    expect(validateOpportunityOrdering(COMMON_ORDERING_PATTERNS.opportunities.nearestDeadline)).toBe(true);
  });
});
