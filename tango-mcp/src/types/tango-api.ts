/**
 * Tango API Response Type Definitions
 *
 * These types represent the response structures from the Tango API.
 * All fields are optional because the API has inconsistent field presence
 * and naming across different endpoints and records.
 *
 * Based on research from 02_tango_api_research.md
 */

/**
 * Contract response from Tango API /contracts/ endpoint
 * Source: FPDS (Federal Procurement Data System)
 */
export interface TangoContractResponse {
  /** Unique contract key/identifier */
  key?: string;
  /** Procurement Instrument Identifier (PIID) */
  piid?: string;
  /** Contract description */
  description?: string;
  /** Contract title */
  title?: string;

  /** Recipient/vendor information (nested format) */
  recipient?: {
    display_name?: string;
    uei?: string;
  };

  /** Vendor name (flat format) */
  vendor_name?: string;
  /** Vendor UEI (flat format) */
  vendor_uei?: string;
  /** Vendor DUNS number (legacy identifier) */
  vendor_duns?: string;

  /** Awarding office information */
  awarding_office?: {
    agency_name?: string;
    agency_code?: string;
    office_name?: string;
  };

  /** Obligated amount */
  obligated?: number;
  /** Total contract value */
  total_contract_value?: number;
  /** Base and exercised options value */
  base_and_exercised_options_value?: number;

  /** Award date (YYYY-MM-DD format) */
  award_date?: string;
  /** Date signed */
  date_signed?: string;

  /** Fiscal year of award (YYYY format) */
  fiscal_year?: number;

  /** NAICS industry classification code */
  naics_code?: string;
  /** NAICS description */
  naics_description?: string;

  /** Product/Service Code */
  psc_code?: string;
  /** PSC description */
  psc_description?: string;

  /** Set-aside type information (nested) */
  set_aside?: {
    code?: string;
  };
  /** Set-aside type (flat format) */
  type_of_set_aside?: string;

  /** Place of performance */
  place_of_performance?: {
    city_name?: string;
    state_name?: string;
    country_name?: string;
  };

  /** Contract status */
  contract_status?: string;
  /** Status (alternative field) */
  status?: string;
}

/**
 * Pagination response wrapper for contract searches
 */
export interface TangoContractListResponse {
  /** Array of contract results */
  results: TangoContractResponse[];
  /** Total number of results available */
  total?: number;
  /** Count of results returned */
  count?: number;
}

/**
 * Grant response from Tango API /grants/ endpoint
 * Source: USASpending.gov
 */
export interface TangoGrantResponse {
  /** Federal Award Identification Number */
  fain?: string;
  /** Grant ID (alternative identifier) */
  grant_id?: string;

  /** Grant description */
  description?: string;
  /** Grant title */
  title?: string;
  /** Project title */
  project_title?: string;

  /** Recipient information */
  recipient?: {
    name?: string;
    uei?: string;
    duns?: string;
    type?: string;
  };

  /** Awarding agency name */
  agency_name?: string;
  /** Awarding agency code */
  agency_code?: string;
  /** Awarding office name */
  office_name?: string;

  /** Award amount */
  award_amount?: number;
  /** Total funding amount */
  total_funding_amount?: number;

  /** Award date (YYYY-MM-DD format) */
  award_date?: string;

  /** Catalog of Federal Domestic Assistance number */
  cfda_number?: string;
  /** CFDA title */
  cfda_title?: string;

  /** Place of performance - city */
  pop_city?: string;
  /** Place of performance - state code */
  pop_state_code?: string;
  /** Place of performance - country code */
  pop_country_code?: string;

  /** Grant status */
  grant_status?: string;

  /** Period of performance start date */
  period_start_date?: string;
  /** Period of performance end date */
  period_end_date?: string;
}

/**
 * Pagination response wrapper for grant searches
 */
export interface TangoGrantListResponse {
  /** Array of grant results */
  results: TangoGrantResponse[];
  /** Total number of results available */
  total?: number;
  /** Count of results returned */
  count?: number;
}

/**
 * Vendor/Entity profile from Tango API /entities/{uei}/ endpoint
 * Source: SAM.gov
 */
export interface TangoVendorResponse {
  /** Unique Entity Identifier (required for vendor lookup) */
  uei: string;

  /** Legal business name */
  legal_business_name?: string;
  /** Display name (alternative) */
  name?: string;

  /** DUNS number (legacy identifier) */
  duns?: string;
  /** CAGE code */
  cage_code?: string;

  /** SAM.gov registration status */
  registration_status?: string;
  /** Registration activation date */
  activation_date?: string;
  /** Registration expiration date */
  expiration_date?: string;

  /** Business types/classifications */
  business_types?: any;
  /** Business type list (alternative field) */
  business_type_list?: any;

  /** Physical address information */
  physical_address?: any;
  /** Mailing address information */
  mailing_address?: any;

  /** Points of contact */
  points_of_contact?: any;
  /** Contacts (alternative field) */
  contacts?: any;

  /** NAICS codes the vendor is registered for */
  naics_codes?: any;
  /** PSC codes the vendor is registered for */
  psc_codes?: any;

  /** Certifications and qualifications */
  certifications?: any;

  /** Total number of contracts */
  total_contracts?: number;
  /** Total value of all contracts */
  total_contract_value?: number;
  /** Total number of grants */
  total_grants?: number;
  /** Total value of all grants */
  total_grant_value?: number;
}

/**
 * Opportunity response from Tango API /opportunities/ endpoint
 * Source: SAM.gov Contract Opportunities
 */
export interface TangoOpportunityResponse {
  /** Unique opportunity identifier */
  opportunity_id?: string;
  /** Notice ID */
  notice_id?: string;
  /** Solicitation number */
  solicitation_number?: string;

  /** Opportunity title */
  title?: string;

  /** Metadata including notice type */
  meta?: {
    notice_type?: {
      type?: string;
    };
  };

  /** Opportunity type */
  opportunity_type?: string;
  /** Type (alternative field) */
  type?: string;

  /** Whether opportunity is currently active */
  active?: boolean;
  /** Status */
  status?: string;

  /** Awarding office information */
  office?: {
    agency_name?: string;
    agency_code?: string;
    office_name?: string;
  };

  /** Posted date (YYYY-MM-DD format) */
  posted_date?: string;
  /** First notice date */
  first_notice_date?: string;
  /** Date posted (alternative field) */
  date_posted?: string;

  /** Response deadline (YYYY-MM-DD format) */
  response_deadline?: string;
  /** Due date (alternative field) */
  due_date?: string;

  /** NAICS code */
  naics_code?: string;

  /** Set-aside information (nested) */
  set_aside?: {
    code?: string;
  };
  /** Set-aside type (flat format) */
  set_aside_type?: string;

  /** Place of performance */
  place_of_performance?: {
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };

  /** Opportunity summary */
  summary?: string;
  /** Description */
  description?: string;

  /** Link to SAM.gov opportunity */
  sam_url?: string;
  /** URL (alternative field) */
  url?: string;
  /** Link (alternative field) */
  link?: string;
}

/**
 * Pagination response wrapper for opportunity searches
 */
export interface TangoOpportunityListResponse {
  /** Array of opportunity results */
  results: TangoOpportunityResponse[];
  /** Total number of results available */
  total?: number;
  /** Count of results returned */
  count?: number;
  /** Pagination cursor for next page */
  next?: string;
}

/**
 * Spending summary aggregation response
 * Note: This uses client-side aggregation of contract data
 */
export interface TangoSpendingResponse {
  /** Total number of contracts in aggregation */
  total_contracts: number;
  /** Total obligated amount */
  total_obligated: number;

  /** Breakdown by aggregation dimension */
  breakdown: TangoSpendingBreakdownItem[];

  /** Dimension used for grouping (agency, vendor, naics, psc, month) */
  group_by: string;
  /** Award type filter applied (contracts, grants, all) */
  award_type: string;

  /** Fiscal year filter if applied */
  fiscal_year?: number;

  /** Filters applied to the query */
  filters: {
    awarding_agency?: string;
    vendor_uei?: string;
  };

  /** Pagination information */
  page_info: {
    limit: number;
    total_available: number | null;
    next_cursor: string | null;
  };
}

/**
 * Individual item in spending breakdown
 */
export interface TangoSpendingBreakdownItem {
  /** Rank in sorted breakdown */
  rank: number;
  /** Unique key for this item */
  key: string;
  /** Display label for this item */
  label: string;
  /** Total obligated amount for this item */
  total_obligated: number;
  /** Number of contracts for this item */
  contract_count: number;
}

/**
 * Generic API response wrapper
 */
export interface TangoApiResponse<T> {
  /** Response data */
  data?: T;
  /** Success flag */
  success: boolean;
  /** Error message if request failed */
  error?: string;
  /** HTTP status code */
  status?: number;
}
