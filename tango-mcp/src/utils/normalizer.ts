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
	TangoFederalObligations,
	TangoGrantOpportunityResponse,
	TangoGrantResponse,
	TangoOpportunityResponse,
	TangoVendorResponse,
	TangoForecastResponse,
	TangoIDVResponse,
} from "@/types/tango-api";

/**
 * IDV (Indefinite Delivery Vehicle) Type Descriptions
 * These codes identify the type of contract vehicle used for parent awards or IDVs
 *
 * CRITICAL: Used in both normalizeContract (for parent_award) and normalizeIDV (for IDV type)
 */
const IDV_TYPE_DESCRIPTIONS: Record<string, string> = {
	A: "GWAC (Government-Wide Acquisition Contract)",
	B: "IDC (Indefinite Delivery Contract)",
	C: "FSS (Federal Supply Schedule)",
	D: "BOA (Basic Ordering Agreement)",
	E: "BPA (Blanket Purchase Agreement)",
};

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

	funding_office: {
		name: string | null;
		code: string | null;
		office: string | null;
	} | null;

	award_amount: number;
	award_date: string | null;
	fiscal_year: number | null;

	naics_code: string | null;
	naics_description: string | null;

	psc_code: string | null;
	psc_description: string | null;

	set_aside: string | null;

	place_of_performance: {
		city: string | null;
		state: string | null;
		country: string | null;
		zip: string | null;
		country_code: string | null;
	};

	status: string | null;

	/** Solicitation identifier */
	solicitation_identifier: string | null;

	/** Parent award information (IDV - Indefinite Delivery Vehicle) */
	parent_award: {
		piid: string | null;
		agency_name: string | null;
		agency_code: string | null;
		idv_type: string | null;
		idv_type_description: string | null;
	} | null;

	/** Contract pricing/type */
	contract_pricing_type: {
		code: string | null;
		description: string | null;
	} | null;

	/** Legislative mandates */
	legislative_mandates: {
		clinger_cohen_act: boolean | null;
		davis_bacon_act: boolean | null;
		service_contract_act: boolean | null;
		walsh_healey_act: boolean | null;
	} | null;

	/** Performance based service acquisition */
	performance_based_service_acquisition: string | null;

	/** Contract bundling */
	contract_bundling: {
		code: string | null;
		description: string | null;
	} | null;

	/** Consolidated contract */
	consolidated_contract: {
		code: string | null;
		description: string | null;
	} | null;

	/** Number of actions/modifications */
	number_of_actions: number | null;

	/** Solicitation date */
	solicitation_date: string | null;
}

/**
 * Normalized grant object with consistent field names
 * @deprecated Use NormalizedGrantOpportunity instead
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
 * Normalized grant opportunity with consistent field names
 */
export interface NormalizedGrantOpportunity {
	/** Internal grant ID and opportunity number */
	grant_id: number | null;
	opportunity_number: string;

	/** Opportunity title and description */
	title: string;
	description: string | null;

	/** Agency information */
	agency: {
		code: string | null;
	};

	/** Opportunity status */
	status: {
		code: string | null;
		description: string | null;
	};

	/** Category information */
	category: {
		code: string | null;
		description: string | null;
	};

	/** Important dates */
	dates: {
		posted: string | null;
		response_deadline: string | null;
		close: string | null;
		archive: string | null;
		estimated_start: string | null;
		estimated_end: string | null;
	};

	/** CFDA numbers */
	cfda_numbers: Array<{
		number: string;
		title: string;
	}>;

	/** Eligible applicant types */
	applicant_types: Array<{
		code: string;
		description: string;
	}>;
	applicant_eligibility: string | null;

	/** Funding categories */
	funding_categories: Array<{
		code: string;
		description: string;
	}>;
	funding_category_description: string | null;

	/** Funding instruments */
	funding_instruments: Array<{
		code: string;
		description: string;
	}>;

	/** Funding details */
	funding: {
		ceiling: number | null;
		floor: number | null;
		estimated_total: number | null;
		expected_awards: number | null;
	};

	/** Grantor contact */
	contact: {
		name: string | null;
		phone: string | null;
		email: string | null;
	};

	/** Additional information */
	additional_info: {
		url: string | null;
		text: string | null;
	};

	/** Last updated timestamp */
	last_updated: string | null;
}

/**
 * Normalized vendor profile with consistent field names
 */
export interface NormalizedVendor {
	uei: string;
	legal_business_name: string;
	dba_name: string | null;
	duns: string | null;
	cage_code: string | null;
	dodaac: string | null;

	registration: {
		status: string | null;
		registered: string | null;
		activation_date: string | null;
		sam_activation_date: string | null;
		expiration_date: string | null;
		sam_expiration_date: string | null;
		sam_registration_date: string | null;
		last_update_date: string | null;
	};

	exclusion: {
		status_flag: string | null;
		url: string | null;
	};

	business_types: unknown[];
	sba_business_types: unknown[];

	entity_structure: {
		code: string | null;
		description: string | null;
	} | null;

	entity_type: {
		code: string | null;
		description: string | null;
	} | null;

	profit_structure: {
		code: string | null;
		description: string | null;
	} | null;

	organization_structure: {
		code: string | null;
		description: string | null;
	} | null;

	incorporation: {
		state_code: string | null;
		state_description: string | null;
		country_code: string | null;
		country_description: string | null;
	} | null;

	entity_division: {
		name: string | null;
		number: string | null;
	} | null;

	entity_start_date: string | null;
	congressional_district: string | null;

	address: {
		physical: unknown;
		mailing: unknown;
	};

	email_address: string | null;
	entity_url: string | null;

	purpose_of_registration: {
		code: string | null;
		description: string | null;
	} | null;

	uei_info: {
		status: string | null;
		creation_date: string | null;
		expiration_date: string | null;
	} | null;

	public_display_flag: string | null;

	description: string | null;
	capabilities: string | null;
	keywords: string | null;

	fiscal_year_end_close_date: string | null;
	submission_date: string | null;

	contacts: unknown[];

	primary_naics: string | null;
	naics_codes: unknown[];
	psc_codes: unknown[];

	certifications: unknown[];

	ownership: {
		highest_owner: unknown;
		immediate_owner: unknown;
	} | null;

	relationships: unknown[];

	performance_summary: {
		total_contracts: number;
		total_contract_value: number;
		total_grants: number;
		total_grant_value: number;
	};

	/** Federal obligations - primary vendor performance metric */
	federal_obligations: TangoFederalObligations;

	evs_source: string | null;

	/** Contract history (when include_history=true) */
	contract_history?: Array<{
		piid?: string;
		title?: string;
		award_date?: string;
		amount?: number;
	}>;

	/** Subaward history (when include_history=true) */
	subaward_history?: Array<{
		award_id?: string;
		title?: string;
		award_date?: string;
		amount?: number;
	}>;
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
		office_address: {
			city: string | null;
			state: string | null;
			zip: string | null;
			country: string | null;
		} | null;
	};

	posted_date: string | null;
	first_notice_date: string | null;
	last_notice_date: string | null;
	response_deadline: string | null;

	naics_code: string | null;
	naics_description: string | null;

	psc_code: string | null;
	psc_description: string | null;

	set_aside: {
		code: string | null;
		description: string | null;
	} | null;

	place_of_performance: {
		city: string | null;
		state: string | null;
		zip: string | null;
		country: string | null;
		address: string | null;
	};

	description: string | null;
	link: string | null;

	award_number: string | null;

	primary_contact: {
		name: string | null;
		email: string | null;
		phone: string | null;
		title: string | null;
	} | null;

	attachments: Array<{
		name: string;
		url: string;
		type: string;
	}>;

	notice_history: Array<{
		date: string;
		type: string;
		description: string;
	}>;

	classification_code: string | null;
	archive_date: string | null;
}

/**
 * Normalized forecast object with consistent field names
 */
export interface NormalizedForecast {
	forecast_id: number;
	source_system: string;
	external_id: string;
	agency: string;
	title: string;
	description: string | null;
	anticipated_award_date: string | null;
	fiscal_year: number | null;
	naics_code: string | null;
	is_active: boolean;
	status: string | null;
	primary_contact: string | null;
	place_of_performance: string | null;
	estimated_period: string | null;
	set_aside: string | null;
	contract_vehicle: string | null;
	/** Data quality warnings (e.g., suspicious dates, missing data) */
	data_quality_warnings?: string[];
}

/**
 * Normalized IDV object with consistent field names
 */
export interface NormalizedIDV {
	idv_id: string;
	piid: string | null;
	description: string | null;

	vendor: {
		name: string;
		uei: string | null;
	};

	agency: {
		name: string | null;
		code: string | null;
		office: string | null;
	};

	funding_office: {
		name: string | null;
		code: string | null;
		office: string | null;
	} | null;

	idv_type: {
		code: string | null;
		description: string | null;
	};

	award_amount: number;
	total_contract_value: number | null;
	award_date: string | null;
	fiscal_year: number | null;

	naics_code: string | null;
	psc_code: string | null;
	set_aside: string | null;

	period_of_performance: {
		start_date: string | null;
		last_date_to_order: string | null;
	};

	multiple_or_single_award: {
		code: string | null;
		description: string | null;
	} | null;

	parent_award: {
		piid: string | null;
		idv_type: string | null;
		agency_name: string | null;
	} | null;

	solicitation_identifier: string | null;
	place_of_performance: {
		city: string | null;
		state: string | null;
		country: string | null;
	};
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
export function normalizeContract(
	contract: TangoContractResponse,
): NormalizedContract {
	// ID fallback: key > piid > "unknown"
	const contract_id = contract.key || contract.piid || "unknown";

	// Title/description fallback
	const title = contract.title || contract.description || "Untitled Contract";
	const description = contract.description || contract.title || null;

	// Vendor name fallback: recipient.display_name > vendor_name > "Unknown Vendor"
	const vendor_name =
		contract.recipient?.display_name ||
		contract.vendor_name ||
		"Unknown Vendor";

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

	// Funding office information
	const funding_office = contract.funding_office
		? {
				name: contract.funding_office.agency_name || null,
				code: contract.funding_office.agency_code || null,
				office: contract.funding_office.office_name || null,
			}
		: null;

	// Set-aside fallback: set_aside.code > type_of_set_aside
	const set_aside =
		contract.set_aside?.code || contract.type_of_set_aside || null;

	// Status fallback: contract_status > status
	const status = contract.contract_status || contract.status || null;

	// Place of performance
	const pop_city = contract.place_of_performance?.city_name || null;
	const pop_state = contract.place_of_performance?.state_name || null;
	const pop_country = contract.place_of_performance?.country_name || null;
	const pop_zip = contract.place_of_performance?.zip || null;
	const pop_country_code = contract.place_of_performance?.country_code || null;

	// Parent award
	const parent_award = contract.parent_award
		? {
				piid: contract.parent_award.piid || null,
				agency_name: contract.parent_award.agency_name || null,
				agency_code: contract.parent_award.agency_code || null,
				idv_type: contract.parent_award.idv_type || null,
				idv_type_description: contract.parent_award.idv_type
					? IDV_TYPE_DESCRIPTIONS[contract.parent_award.idv_type] || null
					: null,
			}
		: null;

	// Contract pricing/type
	const contract_pricing_type = contract.contract_pricing_type
		? {
				code: contract.contract_pricing_type.code || null,
				description: contract.contract_pricing_type.description || null,
			}
		: null;

	// Legislative mandates
	const legislative_mandates = contract.legislative_mandates
		? {
				clinger_cohen_act:
					contract.legislative_mandates.clinger_cohen_act ?? null,
				davis_bacon_act: contract.legislative_mandates.davis_bacon_act ?? null,
				service_contract_act:
					contract.legislative_mandates.service_contract_act ?? null,
				walsh_healey_act:
					contract.legislative_mandates.walsh_healey_act ?? null,
			}
		: null;

	// Contract bundling
	const contract_bundling = contract.contract_bundling
		? {
				code: contract.contract_bundling.code || null,
				description: contract.contract_bundling.description || null,
			}
		: null;

	// Consolidated contract
	const consolidated_contract = contract.consolidated_contract
		? {
				code: contract.consolidated_contract.code || null,
				description: contract.consolidated_contract.description || null,
			}
		: null;

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
		funding_office,
		award_amount,
		award_date,
		fiscal_year: contract.fiscal_year || null,
		naics_code: contract.naics_code || null,
		naics_description: contract.naics_description || null,
		psc_code: contract.psc_code || null,
		psc_description: contract.psc_description || null,
		set_aside,
		place_of_performance: {
			city: pop_city,
			state: pop_state,
			country: pop_country,
			zip: pop_zip,
			country_code: pop_country_code,
		},
		status,
		solicitation_identifier: contract.solicitation_identifier || null,
		parent_award,
		contract_pricing_type,
		legislative_mandates,
		performance_based_service_acquisition:
			contract.performance_based_service_acquisition || null,
		contract_bundling,
		consolidated_contract,
		number_of_actions: contract.number_of_actions || null,
		solicitation_date: contract.solicitation_date || null,
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
 * @deprecated Use normalizeGrantOpportunity instead
 * @param grant Raw Tango API grant response
 * @returns Normalized grant with consistent fields
 */
export function normalizeGrant(grant: TangoGrantResponse): NormalizedGrant {
	// ID fallback: fain > grant_id > "unknown"
	const grant_id = grant.fain || grant.grant_id || "unknown";

	// Title fallback: title > project_title > description > "Untitled Grant"
	const title =
		grant.title || grant.project_title || grant.description || "Untitled Grant";

	const description =
		grant.description || grant.project_title || grant.title || null;

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
 * Normalize grant opportunity response to consistent structure
 *
 * Converts Grants.gov opportunity data from Tango API into a normalized format.
 * Handles array fields, nested objects, and date formatting.
 *
 * @param opportunity Raw Tango API grant opportunity response
 * @returns Normalized grant opportunity with consistent fields
 */
export function normalizeGrantOpportunity(
	opportunity: TangoGrantOpportunityResponse,
): NormalizedGrantOpportunity {
	// ID and opportunity number
	const grant_id = opportunity.grant_id ?? null;
	const opportunity_number = opportunity.opportunity_number || "unknown";

	// Title and description
	const title = opportunity.title || "Untitled Opportunity";
	const description = opportunity.description || null;

	// Agency
	const agency_code = opportunity.agency_code || null;

	// Status
	const status = {
		code: opportunity.status?.code || null,
		description: opportunity.status?.description || null,
	};

	// Category
	const category = {
		code: opportunity.category?.code || null,
		description: opportunity.category?.description || null,
	};

	// Important dates - normalize to YYYY-MM-DD format
	const dates = {
		posted: normalizeDate(opportunity.important_dates?.posted_date),
		response_deadline: normalizeDate(
			opportunity.important_dates?.response_date,
		),
		close: normalizeDate(opportunity.important_dates?.close_date),
		archive: normalizeDate(opportunity.important_dates?.archive_date),
		estimated_start: normalizeDate(
			opportunity.important_dates?.estimated_project_start_date,
		),
		estimated_end: normalizeDate(
			opportunity.important_dates?.estimated_project_end_date,
		),
	};

	// CFDA numbers - normalize array
	const cfda_numbers = Array.isArray(opportunity.cfda_numbers)
		? opportunity.cfda_numbers.map((cfda) => ({
				number: cfda.number || "",
				title: cfda.title || "",
			}))
		: [];

	// Applicant types - normalize array
	const applicant_types = Array.isArray(opportunity.applicant_types)
		? opportunity.applicant_types.map((type) => ({
				code: type.code || "",
				description: type.description || "",
			}))
		: [];

	const applicant_eligibility =
		opportunity.applicant_eligibility_description || null;

	// Funding categories - normalize array
	const funding_categories = Array.isArray(opportunity.funding_categories)
		? opportunity.funding_categories.map((cat) => ({
				code: cat.code || "",
				description: cat.description || "",
			}))
		: [];

	const funding_category_description =
		opportunity.funding_activity_category_description || null;

	// Funding instruments - normalize array
	const funding_instruments = Array.isArray(opportunity.funding_instruments)
		? opportunity.funding_instruments.map((inst) => ({
				code: inst.code || "",
				description: inst.description || "",
			}))
		: [];

	// Funding details - normalize amounts
	const funding = {
		ceiling: opportunity.funding_details?.award_ceiling ?? null,
		floor: opportunity.funding_details?.award_floor ?? null,
		estimated_total:
			opportunity.funding_details?.estimated_total_funding ?? null,
		expected_awards:
			opportunity.funding_details?.expected_number_of_awards ?? null,
	};

	// Contact information
	const contact = {
		name: opportunity.grantor_contact?.name || null,
		phone: opportunity.grantor_contact?.phone || null,
		email: opportunity.grantor_contact?.email || null,
	};

	// Additional information
	const additional_info = {
		url: opportunity.additional_info?.url || null,
		text: opportunity.additional_info?.text || null,
	};

	// Last updated
	const last_updated = opportunity.last_updated || null;

	return {
		grant_id,
		opportunity_number,
		title,
		description,
		agency: {
			code: agency_code,
		},
		status,
		category,
		dates,
		cfda_numbers,
		applicant_types,
		applicant_eligibility,
		funding_categories,
		funding_category_description,
		funding_instruments,
		funding,
		contact,
		additional_info,
		last_updated,
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
	const legal_business_name =
		vendor.legal_business_name || vendor.name || "Unknown Entity";

	// Business types fallback
	const business_types =
		vendor.business_types || vendor.business_type_list || [];
	const sba_business_types = vendor.sba_business_types || [];

	// Contacts fallback
	const contacts = vendor.points_of_contact || vendor.contacts || [];

	// Federal obligations fallback - provide default structure if missing
	const federal_obligations: TangoFederalObligations =
		vendor.federal_obligations || {
			active_contracts: { total_obligated: 0, count: 0 },
			total_contracts: { total_obligated: 0, count: 0 },
		};

	// Entity structure
	const entity_structure =
		vendor.entity_structure_code || vendor.entity_structure_desc
			? {
					code: vendor.entity_structure_code || null,
					description: vendor.entity_structure_desc || null,
				}
			: null;

	// Entity type
	const entity_type =
		vendor.entity_type_code || vendor.entity_type_desc
			? {
					code: vendor.entity_type_code || null,
					description: vendor.entity_type_desc || null,
				}
			: null;

	// Profit structure
	const profit_structure =
		vendor.profit_structure_code || vendor.profit_structure_desc
			? {
					code: vendor.profit_structure_code || null,
					description: vendor.profit_structure_desc || null,
				}
			: null;

	// Organization structure
	const organization_structure =
		vendor.organization_structure_code || vendor.organization_structure_desc
			? {
					code: vendor.organization_structure_code || null,
					description: vendor.organization_structure_desc || null,
				}
			: null;

	// Incorporation details
	const incorporation =
		vendor.state_of_incorporation_code ||
		vendor.state_of_incorporation_desc ||
		vendor.country_of_incorporation_code ||
		vendor.country_of_incorporation_desc
			? {
					state_code: vendor.state_of_incorporation_code || null,
					state_description: vendor.state_of_incorporation_desc || null,
					country_code: vendor.country_of_incorporation_code || null,
					country_description: vendor.country_of_incorporation_desc || null,
				}
			: null;

	// Entity division
	const entity_division =
		vendor.entity_division_name || vendor.entity_division_number
			? {
					name: vendor.entity_division_name || null,
					number: vendor.entity_division_number || null,
				}
			: null;

	// Purpose of registration
	const purpose_of_registration =
		vendor.purpose_of_registration_code || vendor.purpose_of_registration_desc
			? {
					code: vendor.purpose_of_registration_code || null,
					description: vendor.purpose_of_registration_desc || null,
				}
			: null;

	// UEI info
	const uei_info =
		vendor.uei_status || vendor.uei_creation_date || vendor.uei_expiration_date
			? {
					status: vendor.uei_status || null,
					creation_date: vendor.uei_creation_date || null,
					expiration_date: vendor.uei_expiration_date || null,
				}
			: null;

	// Ownership
	const ownership =
		vendor.highest_owner || vendor.immediate_owner
			? {
					highest_owner: vendor.highest_owner || null,
					immediate_owner: vendor.immediate_owner || null,
				}
			: null;

	return {
		uei: vendor.uei,
		legal_business_name,
		dba_name: vendor.dba_name || null,
		duns: vendor.duns || null,
		cage_code: vendor.cage_code || null,
		dodaac: vendor.dodaac || null,
		registration: {
			status: vendor.registration_status || null,
			registered: vendor.registered || null,
			activation_date: vendor.activation_date || null,
			sam_activation_date: vendor.sam_activation_date || null,
			expiration_date: vendor.expiration_date || null,
			sam_expiration_date: vendor.sam_expiration_date || null,
			sam_registration_date: vendor.sam_registration_date || null,
			last_update_date: vendor.last_update_date || null,
		},
		exclusion: {
			status_flag: vendor.exclusion_status_flag || null,
			url: vendor.exclusion_url || null,
		},
		business_types: Array.isArray(business_types) ? business_types : [],
		sba_business_types: Array.isArray(sba_business_types)
			? sba_business_types
			: [],
		entity_structure,
		entity_type,
		profit_structure,
		organization_structure,
		incorporation,
		entity_division,
		entity_start_date: vendor.entity_start_date || null,
		congressional_district: vendor.congressional_district || null,
		address: {
			physical: vendor.physical_address || null,
			mailing: vendor.mailing_address || null,
		},
		email_address: vendor.email_address || null,
		entity_url: vendor.entity_url || null,
		purpose_of_registration,
		uei_info,
		public_display_flag: vendor.public_display_flag || null,
		description: vendor.description || null,
		capabilities: vendor.capabilities || null,
		keywords: vendor.keywords || null,
		fiscal_year_end_close_date: vendor.fiscal_year_end_close_date || null,
		submission_date: vendor.submission_date || null,
		contacts: Array.isArray(contacts) ? contacts : [],
		primary_naics: vendor.primary_naics || null,
		naics_codes: Array.isArray(vendor.naics_codes) ? vendor.naics_codes : [],
		psc_codes: Array.isArray(vendor.psc_codes) ? vendor.psc_codes : [],
		certifications: Array.isArray(vendor.certifications)
			? vendor.certifications
			: [],
		ownership,
		relationships: Array.isArray(vendor.relationships)
			? vendor.relationships
			: [],
		performance_summary: {
			total_contracts: vendor.total_contracts || 0,
			total_contract_value: vendor.total_contract_value || 0,
			total_grants: vendor.total_grants || 0,
			total_grant_value: vendor.total_grant_value || 0,
		},
		federal_obligations,
		evs_source: vendor.evs_source || null,
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
		opportunity.meta?.notice_type?.type ||
		opportunity.opportunity_type ||
		opportunity.type ||
		null;

	// Status - can be 'active' boolean or string status
	const status =
		typeof opportunity.active === "boolean"
			? opportunity.active
				? "active"
				: "inactive"
			: opportunity.status || null;

	// Posted date fallback: posted_date > first_notice_date > date_posted
	const posted_date =
		opportunity.posted_date ||
		opportunity.first_notice_date ||
		opportunity.date_posted ||
		null;

	// First notice date
	const first_notice_date = opportunity.first_notice_date || null;

	// Last notice date
	const last_notice_date = opportunity.last_notice_date || null;

	// Deadline fallback: response_deadline > due_date
	const response_deadline =
		opportunity.response_deadline || opportunity.due_date || null;

	// Set-aside - check for nested object or flat string
	const set_aside =
		opportunity.set_aside?.code ||
		opportunity.set_aside?.description ||
		opportunity.set_aside_type
			? {
					code: opportunity.set_aside?.code || null,
					description: opportunity.set_aside?.description || null,
				}
			: null;

	// Link fallback: sam_url > url > link
	const link =
		opportunity.sam_url || opportunity.url || opportunity.link || null;

	// Description (truncate to 500 chars if too long)
	let description = opportunity.description || opportunity.summary || null;
	if (description && description.length > 500) {
		description = `${description.substring(0, 497)}...`;
	}

	// Office address
	const office_address = opportunity.office?.office_address
		? {
				city: opportunity.office.office_address.city || null,
				state: opportunity.office.office_address.state || null,
				zip: opportunity.office.office_address.zip || null,
				country: opportunity.office.office_address.country || null,
			}
		: null;

	// Primary contact
	const primary_contact = opportunity.primary_contact
		? {
				name: opportunity.primary_contact.name || null,
				email: opportunity.primary_contact.email || null,
				phone: opportunity.primary_contact.phone || null,
				title: opportunity.primary_contact.title || null,
			}
		: null;

	// Attachments
	const attachments = Array.isArray(opportunity.attachments)
		? opportunity.attachments.map((att) => ({
				name: att.name || "",
				url: att.url || "",
				type: att.type || "",
			}))
		: [];

	// Notice history
	const notice_history = Array.isArray(opportunity.notice_history)
		? opportunity.notice_history.map((hist) => ({
				date: hist.date || "",
				type: hist.type || "",
				description: hist.description || "",
			}))
		: [];

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
			office_address,
		},
		posted_date,
		first_notice_date,
		last_notice_date,
		response_deadline,
		naics_code: opportunity.naics_code || null,
		naics_description: opportunity.naics_description || null,
		psc_code: opportunity.psc_code || null,
		psc_description: opportunity.psc_description || null,
		set_aside,
		place_of_performance: {
			city: opportunity.place_of_performance?.city || null,
			state: opportunity.place_of_performance?.state || null,
			zip: opportunity.place_of_performance?.zip || null,
			country: opportunity.place_of_performance?.country || null,
			address: opportunity.place_of_performance?.address || null,
		},
		description,
		link,
		award_number: opportunity.award_number || null,
		primary_contact,
		attachments,
		notice_history,
		classification_code: opportunity.classification_code || null,
		archive_date: opportunity.archive_date || null,
	};
}

/**
 * Parse date string to standard YYYY-MM-DD format
 * Handles various date formats from Tango API
 *
 * @param dateStr Date string in various formats
 * @returns Normalized YYYY-MM-DD string or null if invalid
 */
export function normalizeDate(
	dateStr: string | null | undefined,
): string | null {
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
export function normalizeAmount(
	amount: string | number | null | undefined,
): number {
	if (amount === null || amount === undefined) return 0;

	if (typeof amount === "number") {
		return Number.isNaN(amount) ? 0 : amount;
	}

	// Handle string amounts (might have commas, dollar signs, etc.)
	const cleaned = String(amount).replace(/[$,]/g, "");
	const parsed = Number.parseFloat(cleaned);

	return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Normalize forecast response
 *
 * Handles inconsistencies in forecast API responses with defensive field access
 * and sensible defaults. Includes data quality warnings for transparency.
 *
 * @param raw Raw forecast response from API
 * @returns Normalized forecast with consistent field names and quality warnings
 */
export function normalizeForecast(raw: TangoForecastResponse): NormalizedForecast {
	const anticipated_award_date = raw.anticipated_award_date ?? null;

	// Import at function level to avoid circular dependency
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { getForecastDataQualityWarnings } = require("./data-quality");
	const warnings = getForecastDataQualityWarnings(anticipated_award_date);

	const normalized: NormalizedForecast = {
		forecast_id: raw.id ?? 0,
		source_system: raw.source_system ?? "UNKNOWN",
		external_id: raw.external_id ?? "",
		agency: raw.agency ?? "",
		title: raw.title ?? "Untitled Forecast",
		description: raw.description ?? null,
		anticipated_award_date,
		fiscal_year: raw.fiscal_year ?? null,
		naics_code: raw.naics_code ?? null,
		is_active: raw.is_active ?? false,
		status: raw.status ?? null,
		primary_contact: raw.primary_contact ?? null,
		place_of_performance: raw.place_of_performance ?? null,
		estimated_period: raw.estimated_period ?? null,
		set_aside: raw.set_aside ?? null,
		contract_vehicle: raw.contract_vehicle ?? null,
	};

	// Only add warnings array if there are warnings
	if (warnings.length > 0) {
		normalized.data_quality_warnings = warnings;
	}

	return normalized;
}

/**
 * Normalize IDV response to consistent structure
 *
 * CRITICAL: Applies IDV type code translation in response
 * - A → GWAC (Government-Wide Acquisition Contract)
 * - B → IDC (Indefinite Delivery Contract)
 * - C → FSS (Federal Supply Schedule)
 * - D → BOA (Basic Ordering Agreement)
 * - E → BPA (Blanket Purchase Agreement)
 *
 * @param idv Raw Tango API IDV response
 * @returns Normalized IDV with consistent fields
 */
export function normalizeIDV(idv: TangoIDVResponse): NormalizedIDV {
	// IDV type code translation
	const idvTypeCode = idv.idv_type?.code || null;
	const idvTypeDescription = idvTypeCode
		? IDV_TYPE_DESCRIPTIONS[idvTypeCode]
		: null;

	return {
		idv_id: idv.key || "UNKNOWN",
		piid: idv.piid || null,
		description: idv.description || null,

		vendor: {
			name: idv.recipient?.display_name || "Unknown Vendor",
			uei: idv.recipient?.uei || null,
		},

		agency: {
			name: idv.awarding_office?.agency_name || null,
			code: idv.awarding_office?.agency_code || null,
			office: idv.awarding_office?.office_name || null,
		},

		funding_office: idv.funding_office
			? {
					name: idv.funding_office.agency_name || null,
					code: idv.funding_office.agency_code || null,
					office: idv.funding_office.office_name || null,
				}
			: null,

		idv_type: {
			code: idvTypeCode,
			description: idvTypeDescription || idv.idv_type?.description || null,
		},

		award_amount: idv.obligated || 0,
		total_contract_value: idv.total_contract_value || null,
		award_date: idv.award_date || null,
		fiscal_year: idv.fiscal_year || null,

		naics_code: idv.naics_code || null,
		psc_code: idv.psc_code || null,
		set_aside: idv.set_aside || null,

		period_of_performance: {
			start_date: idv.period_of_performance?.start_date || null,
			last_date_to_order: idv.period_of_performance?.last_date_to_order || null,
		},

		multiple_or_single_award: idv.multiple_or_single_award_idv
			? {
					code: idv.multiple_or_single_award_idv.code || null,
					description: idv.multiple_or_single_award_idv.description || null,
				}
			: null,

		parent_award: idv.parent_award
			? {
					piid: idv.parent_award.piid || null,
					idv_type: idv.parent_award.idv_type || null,
					agency_name: idv.parent_award.awarding_office?.agency_name || null,
				}
			: null,

		solicitation_identifier: idv.solicitation_identifier || null,

		place_of_performance: {
			city: idv.place_of_performance?.city_name || null,
			state: idv.place_of_performance?.state_name || null,
			country: idv.place_of_performance?.country_name || null,
		},
	};
}
