/**
 * Response Normalization Utilities
 *
 * The Tango API has inconsistent field naming across different endpoints
 * and records. These utilities provide robust field fallback logic to
 * handle variations in response structures.
 *
 * Design principle: Defensive parsing with multiple fallback options
 *
 * Based on research from 02_tango_api_research.md
 */

import type {
  TangoContractResponse,
  TangoGrantResponse,
  TangoVendorResponse,
  TangoOpportunityResponse,
  TangoFederalObligations,
} from "@/types/tango-api";

/**
 * Normalized contract object with consistent field names
 */
export interface NormalizedContract {
  contract_id: string;
  title: string;
  description: string | null;

  vendor: {
    name: string;
    uei: string | null;
    duns: string | null;
  };

  agency: {
    name: string | null;
    code: string | null;
    office: string | null;
  };

  award_amount: number;
  award_date: string | null;

  naics_code: string | null;
  naics_description: string | null;

  psc_code: string | null;
  psc_description: string | null;

  set_aside: string | null;

  place_of_performance: {
    city: string | null;
    state: string | null;
    country: string | null;
  };

  status: string | null;
}

/**
 * Normalized grant object with consistent field names
 */
export interface NormalizedGrant {
  grant_id: string;
  title: string;
  description: string | null;

  recipient: {
    name: string;
    uei: string | null;
    duns: string | null;
    type: string | null;
  };

  agency: {
    name: string | null;
    code: string | null;
    office: string | null;
  };

  award_amount: number;
  award_date: string | null;

  cfda: {
    number: string | null;
    title: string | null;
  };

  place_of_performance: {
    city: string | null;
    state: string | null;
    country: string | null;
  };

  status: string | null;

  period_of_performance: {
    start: string | null;
    end: string | null;
  };
}

/**
 * Normalized vendor profile with consistent field names
 */
export interface NormalizedVendor {
  uei: string;
  legal_business_name: string;
  duns: string | null;
  cage_code: string | null;

  registration: {
    status: string | null;
    activation_date: string | null;
    expiration_date: string | null;
  };

  business_types: unknown[];

  address: {
    physical: unknown;
    mailing: unknown;
  };

  contacts: unknown[];

  naics_codes: unknown[];
  psc_codes: unknown[];
  certifications: unknown[];

  performance_summary: {
    total_contracts: number;
    total_contract_value: number;
    total_grants: number;
    total_grant_value: number;
  };

  /** Federal obligations - primary vendor performance metric */
  federal_obligations: TangoFederalObligations;
}

/**
 * Normalized opportunity with consistent field names
 */
export interface NormalizedOpportunity {
  opportunity_id: string;
  solicitation_number: string | null;
  title: string;
  type: string | null;
  status: string | null;

  agency: {
    name: string | null;
    code: string | null;
    office: string | null;
  };

  posted_date: string | null;
  response_deadline: string | null;

  naics_code: string | null;
  set_aside: string | null;

  place_of_performance: {
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
  };

  description: string | null;
  link: string | null;
}

/**
 * Normalize contract response with field fallbacks
 *
 * Handles multiple possible field names for the same data:
 * - ID: key, piid, contract_id
 * - Vendor name: recipient.display_name, vendor_name
 * - Amount: obligated, total_contract_value, base_and_exercised_options_value
 * - Date: award_date, date_signed
 * - Status: contract_status, status
 *
 * @param contract Raw Tango API contract response
 * @returns Normalized contract with consistent fields
 */
export function normalizeContract(contract: TangoContractResponse): NormalizedContract {
  // ID fallback: key > piid > "unknown"
  const contract_id = contract.key || contract.piid || "unknown";

  // Title/description fallback
  const title = contract.title || contract.description || "Untitled Contract";
  const description = contract.description || contract.title || null;

  // Vendor name fallback: recipient.display_name > vendor_name > "Unknown Vendor"
  const vendor_name = contract.recipient?.display_name || contract.vendor_name || "Unknown Vendor";

  // Vendor UEI fallback: recipient.uei > vendor_uei
  const vendor_uei = contract.recipient?.uei || contract.vendor_uei || null;

  // Vendor DUNS
  const vendor_duns = contract.vendor_duns || null;

  // Amount fallback: obligated > total_contract_value > base_and_exercised_options_value > 0
  const award_amount =
    contract.obligated ??
    contract.total_contract_value ??
    contract.base_and_exercised_options_value ??
    0;

  // Date fallback: award_date > date_signed
  const award_date = contract.award_date || contract.date_signed || null;

  // Agency information
  const agency_name = contract.awarding_office?.agency_name || null;
  const agency_code = contract.awarding_office?.agency_code || null;
  const office_name = contract.awarding_office?.office_name || null;

  // Set-aside fallback: set_aside.code > type_of_set_aside
  const set_aside = contract.set_aside?.code || contract.type_of_set_aside || null;

  // Status fallback: contract_status > status
  const status = contract.contract_status || contract.status || null;

  // Place of performance
  const pop_city = contract.place_of_performance?.city_name || null;
  const pop_state = contract.place_of_performance?.state_name || null;
  const pop_country = contract.place_of_performance?.country_name || null;

  return {
    contract_id,
    title,
    description,
    vendor: {
      name: vendor_name,
      uei: vendor_uei,
      duns: vendor_duns,
    },
    agency: {
      name: agency_name,
      code: agency_code,
      office: office_name,
    },
    award_amount,
    award_date,
    naics_code: contract.naics_code || null,
    naics_description: contract.naics_description || null,
    psc_code: contract.psc_code || null,
    psc_description: contract.psc_description || null,
    set_aside,
    place_of_performance: {
      city: pop_city,
      state: pop_state,
      country: pop_country,
    },
    status,
  };
}

/**
 * Normalize grant response with field fallbacks
 *
 * Handles multiple possible field names:
 * - ID: fain, grant_id
 * - Title: title, project_title, description
 * - Amount: award_amount, total_funding_amount
 *
 * @param grant Raw Tango API grant response
 * @returns Normalized grant with consistent fields
 */
export function normalizeGrant(grant: TangoGrantResponse): NormalizedGrant {
  // ID fallback: fain > grant_id > "unknown"
  const grant_id = grant.fain || grant.grant_id || "unknown";

  // Title fallback: title > project_title > description > "Untitled Grant"
  const title =
    grant.title || grant.project_title || grant.description || "Untitled Grant";

  const description = grant.description || grant.project_title || grant.title || null;

  // Recipient name (required for grants)
  const recipient_name = grant.recipient?.name || "Unknown Recipient";

  // Amount fallback: award_amount > total_funding_amount > 0
  const award_amount = grant.award_amount ?? grant.total_funding_amount ?? 0;

  return {
    grant_id,
    title,
    description,
    recipient: {
      name: recipient_name,
      uei: grant.recipient?.uei || null,
      duns: grant.recipient?.duns || null,
      type: grant.recipient?.type || null,
    },
    agency: {
      name: grant.agency_name || null,
      code: grant.agency_code || null,
      office: grant.office_name || null,
    },
    award_amount,
    award_date: grant.award_date || null,
    cfda: {
      number: grant.cfda_number || null,
      title: grant.cfda_title || null,
    },
    place_of_performance: {
      city: grant.pop_city || null,
      state: grant.pop_state_code || null,
      country: grant.pop_country_code || null,
    },
    status: grant.grant_status || null,
    period_of_performance: {
      start: grant.period_start_date || null,
      end: grant.period_end_date || null,
    },
  };
}

/**
 * Normalize vendor response with field fallbacks
 *
 * Handles multiple possible field names:
 * - Name: legal_business_name, name
 * - Business types: business_types, business_type_list
 * - Contacts: points_of_contact, contacts
 *
 * @param vendor Raw Tango API vendor response
 * @returns Normalized vendor with consistent fields
 */
export function normalizeVendor(vendor: TangoVendorResponse): NormalizedVendor {
  // Name fallback: legal_business_name > name > "Unknown Entity"
  const legal_business_name = vendor.legal_business_name || vendor.name || "Unknown Entity";

  // Business types fallback
  const business_types = vendor.business_types || vendor.business_type_list || [];

  // Contacts fallback
  const contacts = vendor.points_of_contact || vendor.contacts || [];

  // Federal obligations fallback - provide default structure if missing
  const federal_obligations: TangoFederalObligations = vendor.federal_obligations || {
    active_contracts: { total_obligated: 0, count: 0 },
    total_contracts: { total_obligated: 0, count: 0 },
  };

  return {
    uei: vendor.uei,
    legal_business_name,
    duns: vendor.duns || null,
    cage_code: vendor.cage_code || null,
    registration: {
      status: vendor.registration_status || null,
      activation_date: vendor.activation_date || null,
      expiration_date: vendor.expiration_date || null,
    },
    business_types: Array.isArray(business_types) ? business_types : [],
    address: {
      physical: vendor.physical_address || null,
      mailing: vendor.mailing_address || null,
    },
    contacts: Array.isArray(contacts) ? contacts : [],
    naics_codes: Array.isArray(vendor.naics_codes) ? vendor.naics_codes : [],
    psc_codes: Array.isArray(vendor.psc_codes) ? vendor.psc_codes : [],
    certifications: Array.isArray(vendor.certifications) ? vendor.certifications : [],
    performance_summary: {
      total_contracts: vendor.total_contracts || 0,
      total_contract_value: vendor.total_contract_value || 0,
      total_grants: vendor.total_grants || 0,
      total_grant_value: vendor.total_grant_value || 0,
    },
    federal_obligations,
  };
}

/**
 * Normalize opportunity response with field fallbacks
 *
 * Handles multiple possible field names:
 * - ID: opportunity_id, notice_id, solicitation_number
 * - Type: meta.notice_type.type, opportunity_type, type
 * - Posted date: posted_date, first_notice_date, date_posted
 * - Deadline: response_deadline, due_date
 * - Link: sam_url, url, link
 *
 * @param opportunity Raw Tango API opportunity response
 * @returns Normalized opportunity with consistent fields
 */
export function normalizeOpportunity(
  opportunity: TangoOpportunityResponse,
): NormalizedOpportunity {
  // ID fallback: opportunity_id > notice_id > solicitation_number > "unknown"
  const opportunity_id =
    opportunity.opportunity_id ||
    opportunity.notice_id ||
    opportunity.solicitation_number ||
    "unknown";

  // Title
  const title = opportunity.title || "Untitled Opportunity";

  // Type fallback: meta.notice_type.type > opportunity_type > type
  const type =
    opportunity.meta?.notice_type?.type || opportunity.opportunity_type || opportunity.type || null;

  // Status - can be 'active' boolean or string status
  const status =
    typeof opportunity.active === "boolean"
      ? opportunity.active
        ? "active"
        : "inactive"
      : opportunity.status || null;

  // Posted date fallback: posted_date > first_notice_date > date_posted
  const posted_date =
    opportunity.posted_date || opportunity.first_notice_date || opportunity.date_posted || null;

  // Deadline fallback: response_deadline > due_date
  const response_deadline = opportunity.response_deadline || opportunity.due_date || null;

  // Set-aside fallback
  const set_aside = opportunity.set_aside?.code || opportunity.set_aside_type || null;

  // Link fallback: sam_url > url > link
  const link = opportunity.sam_url || opportunity.url || opportunity.link || null;

  // Description (truncate to 500 chars if too long)
  let description = opportunity.description || opportunity.summary || null;
  if (description && description.length > 500) {
    description = description.substring(0, 497) + "...";
  }

  return {
    opportunity_id,
    solicitation_number: opportunity.solicitation_number || null,
    title,
    type,
    status,
    agency: {
      name: opportunity.office?.agency_name || null,
      code: opportunity.office?.agency_code || null,
      office: opportunity.office?.office_name || null,
    },
    posted_date,
    response_deadline,
    naics_code: opportunity.naics_code || null,
    set_aside,
    place_of_performance: {
      city: opportunity.place_of_performance?.city || null,
      state: opportunity.place_of_performance?.state || null,
      zip: opportunity.place_of_performance?.zip || null,
      country: opportunity.place_of_performance?.country || null,
    },
    description,
    link,
  };
}

/**
 * Parse date string to standard YYYY-MM-DD format
 * Handles various date formats from Tango API
 *
 * @param dateStr Date string in various formats
 * @returns Normalized YYYY-MM-DD string or null if invalid
 */
export function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;

    return date.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/**
 * Parse amount string/number to number
 * Handles various amount formats from Tango API
 *
 * @param amount Amount as string or number
 * @returns Numeric amount or 0 if invalid
 */
export function normalizeAmount(amount: string | number | null | undefined): number {
  if (amount === null || amount === undefined) return 0;

  if (typeof amount === "number") {
    return Number.isNaN(amount) ? 0 : amount;
  }

  // Handle string amounts (might have commas, dollar signs, etc.)
  const cleaned = String(amount).replace(/[$,]/g, "");
  const parsed = Number.parseFloat(cleaned);

  return Number.isNaN(parsed) ? 0 : parsed;
}
