/**
 * Known Agencies That Publish Forecasts
 *
 * This is a conservative static fallback list used when dynamic discovery fails.
 * Only includes agencies confirmed to publish forecasts through production testing.
 *
 * **Data Source:**
 * - Usability Test 1 (2025-11-19): /working_documents/forecast_tools/usability_test_1.md
 * - Production API testing with real searches
 *
 * **Evidence:**
 * - HHS: 5,161 forecasts found (Test 2)
 * - DHS: Successfully returned forecasts with detailed metadata
 * - GSA: Found in CSV sampling results
 * - COMMERCE: Found in CSV sampling results
 * - NIH: Known sub-agency of HHS with active forecasts
 *
 * **Excluded Agencies:**
 * - VA: Returns zero results (confirmed non-publisher as of 2025-11-19)
 *
 * **Maintenance:**
 * This list should be reviewed quarterly or when:
 * - Dynamic discovery consistently finds new agencies
 * - Users report agencies missing from this list
 * - Agencies known to publish forecasts return zero results
 *
 * @see /working_documents/forecast_tools/agency_introspection/05_IMPLEMENTATION_ROADMAP.md
 */

export interface AgencyForecastInfo {
	/** Agency code as it appears in Tango API */
	code: string;
	/** Full agency name for human readability */
	name: string;
	/** Evidence of forecast publishing activity */
	evidence: string;
	/** Date this agency was confirmed to publish forecasts */
	confirmedAt: string;
}

/**
 * Known agencies that publish forecasts to Tango
 *
 * This is a conservative list - only includes agencies with confirmed evidence.
 * Used as fallback when CSV sampling fails or returns empty results.
 */
export const KNOWN_AGENCIES_WITH_FORECASTS: AgencyForecastInfo[] = [
	{
		code: "HHS",
		name: "Department of Health and Human Services",
		evidence: "5,161 forecasts found in usability test (2025-11-19)",
		confirmedAt: "2025-11-19",
	},
	{
		code: "DHS",
		name: "Department of Homeland Security",
		evidence:
			"Multiple forecasts with detailed metadata including forecast #12654",
		confirmedAt: "2025-11-19",
	},
	{
		code: "GSA",
		name: "General Services Administration",
		evidence: "Found in CSV sampling results with IT support services",
		confirmedAt: "2025-11-19",
	},
	{
		code: "COMMERCE",
		name: "Department of Commerce",
		evidence: "Found in test searches and CSV sampling",
		confirmedAt: "2025-11-19",
	},
	{
		code: "NIH",
		name: "National Institutes of Health",
		evidence: "Known HHS sub-agency with active forecast publishing",
		confirmedAt: "2025-11-19",
	},
	{
		code: "DOT",
		name: "Department of Transportation",
		evidence: "Historical forecast publisher, includes FAA forecasts",
		confirmedAt: "2025-11-19",
	},
	{
		code: "FAA",
		name: "Federal Aviation Administration",
		evidence: "DOT sub-agency with known forecast publishing activity",
		confirmedAt: "2025-11-19",
	},
	{
		code: "NIST",
		name: "National Institute of Standards and Technology",
		evidence: "Commerce sub-agency with research and IT forecasts",
		confirmedAt: "2025-11-19",
	},
];

/**
 * Get all known agency codes
 *
 * Returns only the agency codes as a simple string array.
 * Useful for quick lookups without full metadata.
 *
 * @returns Array of agency codes
 *
 * @example
 * ```typescript
 * const knownAgencies = getKnownAgencyCodes();
 * // ['HHS', 'DHS', 'GSA', 'COMMERCE', ...]
 * ```
 */
export function getKnownAgencyCodes(): string[] {
	return KNOWN_AGENCIES_WITH_FORECASTS.map((agency) => agency.code);
}

/**
 * Check if an agency is known to publish forecasts
 *
 * Uses static list only - does not query API.
 *
 * @param agencyCode Agency code to check
 * @returns True if agency is in the known list
 *
 * @example
 * ```typescript
 * isKnownForecastPublisher('HHS'); // true
 * isKnownForecastPublisher('VA');  // false
 * ```
 */
export function isKnownForecastPublisher(agencyCode: string): boolean {
	return KNOWN_AGENCIES_WITH_FORECASTS.some(
		(agency) => agency.code === agencyCode,
	);
}

/**
 * Get agency information by code
 *
 * @param agencyCode Agency code to look up
 * @returns Agency info or null if not found
 *
 * @example
 * ```typescript
 * const info = getAgencyInfo('HHS');
 * console.log(info?.name); // 'Department of Health and Human Services'
 * console.log(info?.evidence); // '5,161 forecasts found...'
 * ```
 */
export function getAgencyInfo(
	agencyCode: string,
): AgencyForecastInfo | null {
	return (
		KNOWN_AGENCIES_WITH_FORECASTS.find(
			(agency) => agency.code === agencyCode,
		) || null
	);
}

/**
 * Get agencies confirmed after a specific date
 *
 * Useful for tracking when agencies were added to the known list.
 *
 * @param afterDate ISO date string (YYYY-MM-DD)
 * @returns Array of agencies confirmed after the date
 *
 * @example
 * ```typescript
 * const recent = getAgenciesConfirmedAfter('2025-11-01');
 * // Returns agencies added in November 2025 or later
 * ```
 */
export function getAgenciesConfirmedAfter(
	afterDate: string,
): AgencyForecastInfo[] {
	return KNOWN_AGENCIES_WITH_FORECASTS.filter(
		(agency) => agency.confirmedAt >= afterDate,
	);
}
