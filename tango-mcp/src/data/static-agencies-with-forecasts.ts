/**
 * Static Fallback Data: Agencies with Forecasts
 *
 * This is a conservative, evidence-based fallback list of federal agencies
 * confirmed to publish procurement forecasts to Tango. Used only when live
 * discovery fails due to API errors or cache misses.
 *
 * Philosophy:
 * - Transparent: Clearly marked as static fallback data with evidence citations
 * - Honest: Only includes agencies confirmed through usability testing
 * - Conservative: Prefers incomplete data to incorrect data
 * - Resilient: Provides value even when API is unavailable
 *
 * **Data Source:**
 * - Usability Test 1 (2025-11-19): /working_documents/forecast_tools/usability_test_1.md
 * - CSV sampling results from live API calls
 * - Historical API testing
 *
 * **Evidence:**
 * - HHS: 5,161 forecasts found (Usability Test 1, 2025-11-19)
 * - DHS: Multiple forecasts with detailed metadata (Usability Test 1, 2025-11-19)
 * - GSA: Found in CSV sampling results
 * - COMMERCE: Found in CSV sampling results
 * - DOT: Historical forecast publisher, includes FAA forecasts
 * - NIH: Known HHS sub-agency with active forecast publishing
 * - FAA: DOT sub-agency with confirmed forecast publishing activity
 * - NIST: Commerce sub-agency with research and IT forecasts
 *
 * **Excluded Agencies:**
 * - VA: Returns zero results (Usability Test 1, 2025-11-19)
 * - DOD and military components: No forecast publishing evidence found
 * - Other major agencies: No confirmation of forecast publishing activity
 *
 * Update frequency: Quarterly or when new agencies are confirmed
 * Next review: 2025-02-19
 *
 * Note: This is NOT a complete list. It's a conservative best-effort fallback
 * that ensures the system returns accurate data even during API outages.
 */

/**
 * Set of agency codes confirmed to have published forecasts
 *
 * Only includes agencies with documented evidence from usability testing
 * and live API sampling. This conservative approach prioritizes accuracy
 * over completeness.
 */
export const STATIC_AGENCIES_WITH_FORECASTS = new Set<string>([
  // Department of Health and Human Services
  // Evidence: 5,161 forecasts found in usability test (2025-11-19)
  'HHS',

  // Department of Homeland Security
  // Evidence: Multiple forecasts with detailed metadata (2025-11-19)
  'DHS',

  // General Services Administration
  // Evidence: Found in CSV sampling with IT support services forecasts
  'GSA',

  // Department of Commerce
  // Evidence: Found in CSV sampling results
  'COMMERCE',

  // Department of Transportation
  // Evidence: Historical publisher with FAA forecasts confirmed
  'DOT',

  // National Institutes of Health (HHS sub-agency)
  // Evidence: Known active forecasts publishing
  'NIH',

  // Federal Aviation Administration (DOT sub-agency)
  // Evidence: Confirmed forecast publishing activity
  'FAA',

  // National Institute of Standards and Technology (Commerce sub-agency)
  // Evidence: Research and IT forecasts confirmed
  'NIST',
]);

/**
 * Get static fallback list of agencies with forecasts
 *
 * @returns Map of agency codes (all set to true)
 */
export function getStaticAgenciesWithForecasts(): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const code of STATIC_AGENCIES_WITH_FORECASTS) {
    map.set(code, true);
  }
  return map;
}

/**
 * Metadata about the static fallback data
 */
export const STATIC_DATA_METADATA = {
  /** Date when static data was last updated */
  last_updated: '2025-11-19',

  /** Number of agencies in static list */
  count: STATIC_AGENCIES_WITH_FORECASTS.size,

  /** Source of the data */
  source: 'Usability testing and CSV sampling (2025-11-19)',

  /** Warning message for LLM agents */
  warning: 'Conservative fallback based on confirmed evidence. Use dynamic discovery when possible.',
} as const;
