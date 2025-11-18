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

  /** Funding office information */
  funding_office?: {
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
    zip?: string;
    country_code?: string;
  };

  /** Contract status */
  contract_status?: string;
  /** Status (alternative field) */
  status?: string;

  /** Solicitation identifier */
  solicitation_identifier?: string;

  /** Parent award information */
  parent_award?: {
    piid?: string;
    agency_name?: string;
    agency_code?: string;
  };

  /** Contract pricing/type information */
  contract_pricing_type?: {
    code?: string;
    description?: string;
  };

  /** Legislative mandates */
  legislative_mandates?: {
    clinger_cohen_act?: boolean;
    davis_bacon_act?: boolean;
    service_contract_act?: boolean;
    walsh_healey_act?: boolean;
  };

  /** Performance based service acquisition */
  performance_based_service_acquisition?: string;

  /** Contract bundling */
  contract_bundling?: {
    code?: string;
    description?: string;
  };

  /** Consolidated contract */
  consolidated_contract?: {
    code?: string;
    description?: string;
  };

  /** Number of actions */
  number_of_actions?: number;

  /** Solicitation date */
  solicitation_date?: string;
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
 * Grant opportunity response from Tango API /grants/ endpoint
 * Source: Grants.gov (pre-award opportunities)
 *
 * This endpoint returns grant opportunities from Grants.gov, NOT
 * USASpending awards. These are pre-award opportunities available
 * for application, not post-award data.
 */
export interface TangoGrantOpportunityResponse {
  /** Internal grant opportunity ID */
  grant_id?: number;

  /** Grants.gov opportunity number (e.g., "DOTBAB01062025") */
  opportunity_number?: string;

  /** Agency code (e.g., "DOT-DOT X-50") */
  agency_code?: string | null;

  /** Opportunity status */
  status?: {
    code?: string;
    description?: string;
  };

  /** Opportunity title */
  title?: string;

  /** Detailed description */
  description?: string | null;

  /** Important dates for the opportunity */
  important_dates?: {
    posted_date?: string;
    response_date?: string;
    close_date?: string;
    archive_date?: string;
    estimated_project_start_date?: string;
    estimated_project_end_date?: string;
  };

  /** Opportunity category */
  category?: {
    code?: string;
    description?: string;
  };

  /** Array of CFDA numbers with titles */
  cfda_numbers?: Array<{
    number?: string;
    title?: string;
  }>;

  /** Types of eligible applicants */
  applicant_types?: Array<{
    code?: string;
    description?: string;
  }>;

  /** Applicant eligibility description */
  applicant_eligibility_description?: string | null;

  /** Funding activity categories */
  funding_categories?: Array<{
    code?: string;
    description?: string;
  }>;

  /** Funding activity category description */
  funding_activity_category_description?: string | null;

  /** Funding instrument types */
  funding_instruments?: Array<{
    code?: string;
    description?: string;
  }>;

  /** Funding details */
  funding_details?: {
    award_ceiling?: number | null;
    award_floor?: number | null;
    estimated_total_funding?: number | null;
    expected_number_of_awards?: number | null;
  };

  /** Grantor contact information */
  grantor_contact?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  };

  /** Additional information */
  additional_info?: {
    url?: string | null;
    text?: string | null;
  };

  /** Last updated timestamp */
  last_updated?: string;
}

/**
 * Legacy grant response interface (DEPRECATED)
 *
 * This interface was based on a misunderstanding that /api/grants/
 * returned USASpending awards. It actually returns Grants.gov opportunities.
 *
 * @deprecated Use TangoGrantOpportunityResponse instead
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
 * Pagination response wrapper for grant opportunity searches
 */
export interface TangoGrantOpportunityListResponse {
  /** Array of grant opportunity results */
  results: TangoGrantOpportunityResponse[];
  /** Total number of results available */
  total?: number;
  /** Count of results returned */
  count?: number;
  /** Next page URL */
  next?: string | null;
  /** Previous page URL */
  previous?: string | null;
}

/**
 * Legacy pagination response wrapper
 * @deprecated Use TangoGrantOpportunityListResponse instead
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
 * Federal obligations data for vendor performance
 * Primary vendor performance metric from Tango API
 */
export interface TangoFederalObligations {
  /** Active contract obligations */
  active_contracts?: {
    total_obligated?: number;
    count?: number;
  };
  /** Total historical contract obligations */
  total_contracts?: {
    total_obligated?: number;
    count?: number;
  };
  /** Active subaward obligations */
  active_subawards?: {
    total_obligated?: number;
    count?: number;
  };
  /** Total historical subaward obligations */
  total_subawards?: {
    total_obligated?: number;
    count?: number;
  };
  /** Active IDV (Indefinite Delivery Vehicle) count */
  active_idvs?: {
    count?: number;
  };
  /** Total historical IDV count */
  total_idvs?: {
    count?: number;
  };
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
  /** DBA (Doing Business As) name */
  dba_name?: string;

  /** DUNS number (legacy identifier) */
  duns?: string;
  /** CAGE code */
  cage_code?: string;
  /** DODAAC code */
  dodaac?: string;

  /** SAM.gov registration status */
  registration_status?: string;
  /** Registration activated flag */
  registered?: string;
  /** Registration activation date */
  activation_date?: string;
  /** SAM activation date */
  sam_activation_date?: string;
  /** Registration expiration date */
  expiration_date?: string;
  /** SAM expiration date */
  sam_expiration_date?: string;
  /** SAM registration date */
  sam_registration_date?: string;
  /** Last update date */
  last_update_date?: string;

  /** Exclusion status flag */
  exclusion_status_flag?: string;
  /** Exclusion URL */
  exclusion_url?: string;

  /** Business types/classifications */
  business_types?: any;
  /** Business type list (alternative field) */
  business_type_list?: any;
  /** SBA business types */
  sba_business_types?: any;

  /** Entity structure information */
  entity_structure_code?: string;
  entity_structure_desc?: string;

  /** Entity type information */
  entity_type_code?: string;
  entity_type_desc?: string;

  /** Profit structure information */
  profit_structure_code?: string;
  profit_structure_desc?: string;

  /** Organization structure information */
  organization_structure_code?: string;
  organization_structure_desc?: string;

  /** Incorporation details */
  state_of_incorporation_code?: string;
  state_of_incorporation_desc?: string;
  country_of_incorporation_code?: string;
  country_of_incorporation_desc?: string;

  /** Entity division information */
  entity_division_name?: string;
  entity_division_number?: string;

  /** Entity start date */
  entity_start_date?: string;

  /** Congressional district */
  congressional_district?: string;

  /** Physical address information */
  physical_address?: any;
  /** Mailing address information */
  mailing_address?: any;

  /** Email address */
  email_address?: string;

  /** Entity URL */
  entity_url?: string;

  /** Purpose of registration */
  purpose_of_registration_code?: string;
  purpose_of_registration_desc?: string;

  /** UEI status and dates */
  uei_status?: string;
  uei_creation_date?: string;
  uei_expiration_date?: string;

  /** Public display flag */
  public_display_flag?: string;

  /** Description and capabilities */
  description?: string;
  capabilities?: string;
  keywords?: string;

  /** Fiscal year end close date */
  fiscal_year_end_close_date?: string;
  /** Submission date */
  submission_date?: string;

  /** Points of contact */
  points_of_contact?: any;
  /** Contacts (alternative field) */
  contacts?: any;

  /** Primary NAICS */
  primary_naics?: string;
  /** NAICS codes the vendor is registered for */
  naics_codes?: any;
  /** PSC codes the vendor is registered for */
  psc_codes?: any;

  /** Certifications and qualifications */
  certifications?: any;

  /** Ownership information */
  highest_owner?: any;
  immediate_owner?: any;

  /** Relationships */
  relationships?: any[];

  /** Total number of contracts */
  total_contracts?: number;
  /** Total value of all contracts */
  total_contract_value?: number;
  /** Total number of grants */
  total_grants?: number;
  /** Total value of all grants */
  total_grant_value?: number;

  /** Federal obligations - primary vendor performance metric */
  federal_obligations?: TangoFederalObligations;

  /** EVS source */
  evs_source?: string;
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
    office_address?: {
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    };
  };

  /** Posted date (YYYY-MM-DD format) */
  posted_date?: string;
  /** First notice date */
  first_notice_date?: string;
  /** Last notice date */
  last_notice_date?: string;
  /** Date posted (alternative field) */
  date_posted?: string;

  /** Response deadline (YYYY-MM-DD format) */
  response_deadline?: string;
  /** Due date (alternative field) */
  due_date?: string;

  /** NAICS code */
  naics_code?: string;
  /** NAICS description */
  naics_description?: string;

  /** PSC (Product/Service Code) */
  psc_code?: string;
  /** PSC description */
  psc_description?: string;

  /** Set-aside information (nested) */
  set_aside?: {
    code?: string;
    description?: string;
  };
  /** Set-aside type (flat format) */
  set_aside_type?: string;

  /** Place of performance */
  place_of_performance?: {
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    address?: string;
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

  /** Award number */
  award_number?: string;

  /** Primary contact */
  primary_contact?: {
    name?: string;
    email?: string;
    phone?: string;
    title?: string;
  };

  /** Attachments */
  attachments?: Array<{
    name?: string;
    url?: string;
    type?: string;
  }>;

  /** Notice history */
  notice_history?: Array<{
    date?: string;
    type?: string;
    description?: string;
  }>;

  /** Classification code */
  classification_code?: string;

  /** Archive date */
  archive_date?: string;
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
 * Vendor contract history item
 * Simplified contract data for history display
 */
export interface TangoVendorContractHistoryItem {
  /** Procurement Instrument Identifier */
  piid?: string;
  /** Contract title/description */
  title?: string;
  /** Contract description */
  description?: string;
  /** Award date (YYYY-MM-DD format) */
  award_date?: string;
  /** Obligated amount */
  amount?: number;
  /** Awarding agency information */
  agency?: {
    name?: string;
    code?: string;
  };
}

/**
 * Vendor subaward/grant history item
 * Simplified subaward data for history display
 */
export interface TangoVendorSubawardHistoryItem {
  /** Subaward ID */
  award_id?: string;
  /** Subaward title/description */
  title?: string;
  /** Award date (YYYY-MM-DD format) */
  award_date?: string;
  /** Award amount */
  amount?: number;
  /** Prime contract PIID */
  prime_contract_piid?: string;
}

/**
 * Contract detail response from Tango API /contracts/{key}/ endpoint
 * Returns comprehensive contract details including all fields from list view plus additional data
 */
export interface TangoContractDetailResponse extends TangoContractResponse {
  /** All standard contract fields are included */
  [key: string]: any;
}

/**
 * Grant opportunity detail response from Tango API /grants/{grant_id}/ endpoint
 * Returns comprehensive grant opportunity details
 */
export interface TangoGrantOpportunityDetailResponse extends TangoGrantOpportunityResponse {
  /** All standard grant opportunity fields are included */
  [key: string]: any;
}

/**
 * Opportunity detail response from Tango API /opportunities/{opportunity_id}/ endpoint
 * Returns comprehensive opportunity details
 */
export interface TangoOpportunityDetailResponse extends TangoOpportunityResponse {
  /** All standard opportunity fields are included */
  [key: string]: any;
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
