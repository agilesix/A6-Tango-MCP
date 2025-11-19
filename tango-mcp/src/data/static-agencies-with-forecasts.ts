/**
 * Static Fallback Data: Agencies with Forecasts
 *
 * This is a curated list of federal agencies known to publish procurement
 * forecasts to Tango. Used as a fallback when live discovery fails.
 *
 * Philosophy:
 * - Transparent: Clearly marked as static fallback data
 * - Honest: Only includes agencies we've actually observed
 * - Resilient: Provides value even when API is unavailable
 *
 * Data source: Manual observation of Tango forecast data
 * Last updated: 2025-01-19
 * Update frequency: Quarterly or when major agencies are added
 *
 * Note: This is NOT a complete list. It's a best-effort fallback
 * that ensures the system remains functional during outages.
 */

/**
 * Set of agency codes known to have published forecasts
 *
 * These are the major federal agencies that regularly publish
 * procurement forecasts to Tango's /api/forecasts/ endpoint.
 */
export const STATIC_AGENCIES_WITH_FORECASTS = new Set<string>([
  // Department of Health and Human Services
  'HHS',

  // Department of Homeland Security
  'DHS',

  // General Services Administration
  'GSA',

  // Department of Veterans Affairs
  'VA',

  // Department of Defense (and major components)
  'DOD',
  'ARMY',
  'NAVY',
  'AIR_FORCE',

  // Department of Energy
  'DOE',

  // Department of State
  'DOS',

  // Department of Justice
  'DOJ',

  // Department of Agriculture
  'USDA',

  // Department of Transportation
  'DOT',

  // Department of the Interior
  'DOI',

  // Department of Commerce
  'DOC',

  // National Aeronautics and Space Administration
  'NASA',

  // Environmental Protection Agency
  'EPA',

  // Small Business Administration
  'SBA',

  // Social Security Administration
  'SSA',
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
  last_updated: '2025-01-19',

  /** Number of agencies in static list */
  count: STATIC_AGENCIES_WITH_FORECASTS.size,

  /** Source of the data */
  source: 'Manual observation of Tango forecast API',

  /** Warning message for LLM agents */
  warning: 'This is static fallback data. Live discovery may show different results.',
} as const;
