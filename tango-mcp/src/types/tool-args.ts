/**
 * Tool Argument Type Definitions
 *
 * These interfaces define the input arguments for each MCP tool.
 * All fields are optional to provide maximum flexibility for LLM agents.
 * Each field includes rich documentation with examples and format specifications.
 *
 * Design principle: Agent-optimized with verbose descriptions for discoverability
 */

/**
 * Arguments for search_tango_contracts tool
 *
 * Searches federal contract awards from FPDS through Tango API.
 * Supports filtering by vendor, agency, industry codes, dates, and set-aside types.
 */
export interface SearchContractsArgs {
  /**
   * Free-text search across contract descriptions and titles
   *
   * @example "IT services"
   * @example "cloud computing"
   * @example "cyber security"
   */
  query?: string;

  /**
   * Vendor/contractor name filter
   * Case-insensitive partial match
   *
   * @example "Lockheed Martin"
   * @example "IBM"
   * @example "Microsoft"
   */
  vendor_name?: string;

  /**
   * Unique Entity Identifier (12-character alphanumeric)
   * For exact vendor matching
   *
   * @example "J3RW5C5KVLZ1"
   * @format UEI format (12 uppercase alphanumeric)
   */
  vendor_uei?: string;

  /**
   * Awarding agency name or code
   *
   * @example "Department of Defense"
   * @example "DOD"
   * @example "General Services Administration"
   * @example "GSA"
   */
  awarding_agency?: string;

  /**
   * NAICS industry classification code (2-6 digits)
   *
   * @example "541512" - Computer systems design services
   * @example "541330" - Engineering services
   * @example "5415" - Computer systems design and related services
   */
  naics_code?: string;

  /**
   * Product/Service Code
   *
   * @example "D302" - IT and telecom - systems development
   * @example "R425" - Support - professional: engineering/technical
   */
  psc_code?: string;

  /**
   * Earliest award date to include
   * Format: YYYY-MM-DD
   *
   * @example "2024-01-01"
   * @example "2023-10-01" - Start of fiscal year
   */
  award_date_start?: string;

  /**
   * Latest award date to include
   * Format: YYYY-MM-DD
   *
   * @example "2024-12-31"
   * @example "2024-09-30" - End of fiscal year
   */
  award_date_end?: string;

  /**
   * Contract set-aside category
   * Values: 'SBA', 'WOSB', 'SDVOSB', '8A', 'HUBZone'
   * Leave empty for all types
   *
   * @example "SBA" - Small Business Administration set-aside
   * @example "WOSB" - Women-Owned Small Business
   * @example "SDVOSB" - Service-Disabled Veteran-Owned Small Business
   * @example "8A" - 8(a) Business Development program
   * @example "HUBZone" - Historically Underutilized Business Zone
   */
  set_aside_type?: string;

  /**
   * Maximum results to return
   * Default: 10
   * Maximum: 100
   * Use smaller values for faster responses
   *
   * @example 10
   * @example 50
   * @example 100
   */
  limit?: number;
}

/**
 * Arguments for search_tango_grants tool
 *
 * Searches federal grants and financial assistance awards.
 * Client-side filtering applied for recipient and amount ranges.
 */
export interface SearchGrantsArgs {
  /**
   * Free-text search across grant descriptions and titles
   *
   * @example "education"
   * @example "research"
   * @example "community development"
   */
  query?: string;

  /**
   * Awarding agency name or code
   *
   * @example "Department of Education"
   * @example "ED"
   * @example "National Science Foundation"
   * @example "NSF"
   */
  agency?: string;

  /**
   * Recipient organization name (client-side filtering)
   * Case-insensitive partial match
   *
   * @example "Stanford University"
   * @example "City of Boston"
   */
  recipient_name?: string;

  /**
   * Recipient Unique Entity Identifier (client-side filtering)
   * 12-character alphanumeric
   *
   * @example "A1B2C3D4E5F6"
   */
  recipient_uei?: string;

  /**
   * Catalog of Federal Domestic Assistance number
   *
   * @example "84.027" - Special Education Grants to States
   * @example "93.778" - Medical Assistance Program
   */
  cfda_number?: string;

  /**
   * Earliest posted date to include
   * Format: YYYY-MM-DD
   *
   * @example "2024-01-01"
   */
  posted_date_after?: string;

  /**
   * Latest posted date to include
   * Format: YYYY-MM-DD
   *
   * @example "2024-12-31"
   */
  posted_date_before?: string;

  /**
   * Minimum award amount (client-side filtering)
   * In dollars
   *
   * @example 100000
   * @example 1000000
   */
  award_amount_min?: number;

  /**
   * Maximum award amount (client-side filtering)
   * In dollars
   *
   * @example 500000
   * @example 10000000
   */
  award_amount_max?: number;

  /**
   * Maximum results to return
   * Default: 10
   * Maximum: 100
   *
   * @example 10
   * @example 50
   */
  limit?: number;
}

/**
 * Arguments for get_tango_vendor_profile tool
 *
 * Retrieves comprehensive entity profile from SAM.gov.
 * Includes registration details, certifications, and performance history.
 */
export interface GetVendorProfileArgs {
  /**
   * Unique Entity Identifier (REQUIRED)
   * 12-character alphanumeric
   *
   * @example "J3RW5C5KVLZ1"
   * @format UEI format (12 uppercase alphanumeric)
   */
  uei: string;

  /**
   * Include recent contract and grant history
   * Default: false
   * When true, fetches up to history_limit recent contracts and subawards
   *
   * @example true
   * @example false
   */
  include_history?: boolean;

  /**
   * Maximum number of history records to fetch per type (contracts and subawards)
   * Only used when include_history is true
   * Default: 10
   * Maximum: 50
   *
   * @example 10
   * @example 25
   */
  history_limit?: number;
}

/**
 * Arguments for search_tango_opportunities tool
 *
 * Searches federal contract opportunities and solicitation notices.
 * Finds active and forecasted opportunities from SAM.gov.
 */
export interface SearchOpportunitiesArgs {
  /**
   * Free-text search across opportunity titles and descriptions
   *
   * @example "cybersecurity"
   * @example "software development"
   * @example "construction"
   */
  query?: string;

  /**
   * Awarding agency name or code
   *
   * @example "Department of Defense"
   * @example "DOD"
   */
  agency?: string;

  /**
   * NAICS industry classification code (2-6 digits)
   *
   * @example "541512" - Computer systems design services
   * @example "236220" - Commercial and institutional building construction
   */
  naics_code?: string;

  /**
   * Set-aside type filter
   * Values: 'SBA', 'WOSB', 'SDVOSB', '8A', 'HUBZone'
   *
   * @example "SBA"
   * @example "WOSB"
   */
  set_aside_type?: string;

  /**
   * Earliest posted date to include
   * Format: YYYY-MM-DD
   *
   * @example "2024-01-01"
   */
  posted_date_after?: string;

  /**
   * Latest posted date to include
   * Format: YYYY-MM-DD
   *
   * @example "2024-12-31"
   */
  posted_date_before?: string;

  /**
   * Minimum response deadline
   * Only include opportunities with deadlines on or after this date
   * Format: YYYY-MM-DD
   *
   * @example "2024-12-01"
   */
  response_deadline_after?: string;

  /**
   * Filter by opportunity status
   * Values: 'active', 'inactive', 'closed', 'forecasted'
   *
   * @example "active" - Currently accepting responses
   * @example "forecasted" - Upcoming opportunities
   */
  status?: string;

  /**
   * Notice type code
   * Common values: 'f' for forecasted, 'p' for presolicitation, 's' for solicitation
   *
   * @example "f" - Forecasted opportunities
   * @example "s" - Active solicitations
   */
  notice_type?: string;

  /**
   * Maximum results to return
   * Default: 10
   * Maximum: 100
   *
   * @example 10
   * @example 25
   */
  limit?: number;
}

/**
 * Arguments for get_tango_spending_summary tool
 *
 * Generates aggregated spending analytics by various dimensions.
 * Uses client-side aggregation of contract data.
 */
export interface GetSpendingSummaryArgs {
  /**
   * Awarding agency name or code
   * Filter spending by specific agency
   *
   * @example "Department of Defense"
   * @example "DOD"
   */
  awarding_agency?: string;

  /**
   * Vendor Unique Entity Identifier
   * Filter spending for specific vendor
   *
   * @example "J3RW5C5KVLZ1"
   */
  vendor_uei?: string;

  /**
   * Fiscal year (YYYY format)
   * Filter spending by fiscal year
   *
   * @example 2024
   * @example 2023
   */
  fiscal_year?: number;

  /**
   * Award type to include
   * Values: 'contracts', 'grants', 'all'
   * Default: 'contracts'
   *
   * @example "contracts"
   * @example "grants"
   * @example "all"
   */
  award_type?: string;

  /**
   * Aggregation dimension
   * Values: 'agency', 'vendor', 'naics', 'psc', 'month'
   * Default: 'vendor'
   *
   * @example "agency" - Group by awarding agency
   * @example "vendor" - Group by recipient/vendor
   * @example "naics" - Group by NAICS industry code
   * @example "psc" - Group by Product/Service Code
   * @example "month" - Group by award month (YYYY-MM)
   */
  group_by?: string;

  /**
   * Number of results to include in aggregation
   * Higher values = more complete data but slower
   * Default: 100
   * Maximum: 100
   *
   * @example 50
   * @example 100
   */
  limit?: number;
}
