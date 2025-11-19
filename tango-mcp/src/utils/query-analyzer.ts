/**
 * Query Analyzer Utility
 *
 * Analyzes user queries to detect agency patterns, NAICS codes, and other
 * structured search criteria that could be better served by specific API parameters.
 *
 * This helps improve search quality by suggesting the use of structured filters
 * instead of relying solely on keyword search.
 */

/**
 * Analysis result for a search query
 */
export interface QueryAnalysis {
	/** The original query text */
	originalQuery: string;
	/** Detected agency code (e.g., "VA", "DOD") */
	suggestedAgency?: string;
	/** Full agency name */
	suggestedAgencyName?: string;
	/** Detected NAICS code */
	suggestedNaics?: string;
	/** Additional filter suggestions */
	suggestedFilters?: string;
	/** Query with detected entities removed */
	refinedQuery?: string;
	/** Confidence level of the detection */
	confidence: "high" | "medium" | "low";
	/** Human-readable suggestion for the user */
	suggestion?: string;
}

/**
 * Agency pattern definition
 */
interface AgencyPattern {
	/** Regex pattern to match */
	pattern: RegExp;
	/** Agency code */
	code: string;
	/** Full agency name */
	name: string;
	/** Alternative codes that might appear in data */
	aliases?: string[];
}

/**
 * Comprehensive list of federal agency patterns
 */
const AGENCY_PATTERNS: AgencyPattern[] = [
	{
		pattern: /\b(VA|Veterans Affairs|Department of Veterans Affairs|DVA)\b/gi,
		code: "VA",
		name: "Department of Veterans Affairs",
		aliases: ["DVA", "VETERANS AFFAIRS"],
	},
	{
		pattern: /\b(DOD|Defense|Department of Defense|DoD|Pentagon)\b/gi,
		code: "DOD",
		name: "Department of Defense",
		aliases: ["DEFENSE", "DEPT OF DEFENSE"],
	},
	{
		pattern: /\b(DHS|Homeland Security|Department of Homeland Security)\b/gi,
		code: "DHS",
		name: "Department of Homeland Security",
		aliases: ["HOMELAND SECURITY"],
	},
	{
		pattern: /\b(GSA|General Services Administration|General Services)\b/gi,
		code: "GSA",
		name: "General Services Administration",
		aliases: ["GENERAL SERVICES"],
	},
	{
		pattern:
			/\b(NASA|National Aeronautics and Space Administration|Space Administration)\b/gi,
		code: "NASA",
		name: "National Aeronautics and Space Administration",
		aliases: ["AERONAUTICS AND SPACE"],
	},
	{
		pattern: /\b(DOE|Department of Energy|Energy Department)\b/gi,
		code: "DOE",
		name: "Department of Energy",
		aliases: ["ENERGY", "DEPT OF ENERGY"],
	},
	{
		pattern:
			/\b(DOT|Department of Transportation|Transportation Department)\b/gi,
		code: "DOT",
		name: "Department of Transportation",
		aliases: ["TRANSPORTATION", "DEPT OF TRANSPORTATION"],
	},
	{
		pattern: /\b(DOJ|Department of Justice|Justice Department)\b/gi,
		code: "DOJ",
		name: "Department of Justice",
		aliases: ["JUSTICE", "DEPT OF JUSTICE"],
	},
	{
		pattern:
			/\b(HHS|Health and Human Services|Department of Health and Human Services|DHHS)\b/gi,
		code: "HHS",
		name: "Department of Health and Human Services",
		aliases: ["HEALTH AND HUMAN SERVICES", "DHHS"],
	},
	{
		pattern: /\b(DOL|Department of Labor|Labor Department)\b/gi,
		code: "DOL",
		name: "Department of Labor",
		aliases: ["LABOR", "DEPT OF LABOR"],
	},
	{
		pattern: /\b(State Department|Department of State|DOS|State Dept)\b/gi,
		code: "STATE",
		name: "Department of State",
		aliases: ["DOS", "STATE DEPT"],
	},
	{
		pattern: /\b(Treasury|Department of the Treasury|Treasury Department)\b/gi,
		code: "TREAS",
		name: "Department of the Treasury",
		aliases: ["TREASURY", "DEPT OF TREASURY"],
	},
	{
		pattern:
			/\b(USDA|Agriculture|Department of Agriculture|Agriculture Department)\b/gi,
		code: "USDA",
		name: "Department of Agriculture",
		aliases: ["AGRICULTURE", "DEPT OF AGRICULTURE"],
	},
	{
		pattern:
			/\b(DOI|Interior|Department of the Interior|Interior Department)\b/gi,
		code: "DOI",
		name: "Department of the Interior",
		aliases: ["INTERIOR", "DEPT OF INTERIOR"],
	},
	{
		pattern:
			/\b(EPA|Environmental Protection Agency|Environmental Protection)\b/gi,
		code: "EPA",
		name: "Environmental Protection Agency",
		aliases: ["ENVIRONMENTAL PROTECTION"],
	},
	{
		pattern: /\b(SBA|Small Business Administration|Small Business Admin)\b/gi,
		code: "SBA",
		name: "Small Business Administration",
		aliases: ["SMALL BUSINESS"],
	},
	{
		pattern: /\b(SSA|Social Security Administration|Social Security)\b/gi,
		code: "SSA",
		name: "Social Security Administration",
		aliases: ["SOCIAL SECURITY"],
	},
	{
		pattern:
			/\b(USAID|US AID|U\.S\. AID|Agency for International Development)\b/gi,
		code: "USAID",
		name: "U.S. Agency for International Development",
		aliases: ["AID"],
	},
	{
		pattern: /\b(Commerce|Department of Commerce|Commerce Department)\b/gi,
		code: "DOC",
		name: "Department of Commerce",
		aliases: ["COMMERCE", "DEPT OF COMMERCE"],
	},
	{
		pattern:
			/\b(Education|Department of Education|Education Department|ED)\b/gi,
		code: "ED",
		name: "Department of Education",
		aliases: ["EDUCATION", "DEPT OF EDUCATION"],
	},
];

/**
 * NAICS code pattern - matches 2-6 digit NAICS codes
 */
const NAICS_PATTERN = /\b(NAICS|naics)?\s*[:-]?\s*(\d{2,6})\b/gi;

/**
 * Analyzes a search query to detect agencies, NAICS codes, and suggest improvements
 *
 * @param query - The user's search query
 * @returns Analysis result with suggestions
 *
 * @example
 * ```typescript
 * const result = analyzeQuery("VA medical equipment contracts");
 * // Returns:
 * // {
 * //   originalQuery: "VA medical equipment contracts",
 * //   suggestedAgency: "VA",
 * //   suggestedAgencyName: "Department of Veterans Affairs",
 * //   refinedQuery: "medical equipment contracts",
 * //   confidence: "high",
 * //   suggestion: "Use awarding_agency='VA' for better results"
 * // }
 * ```
 */
export function analyzeQuery(query: string): QueryAnalysis {
	const result: QueryAnalysis = {
		originalQuery: query,
		confidence: "low",
	};

	let refinedQuery = query;
	const detections: string[] = [];

	// Check for agency patterns
	for (const agencyPattern of AGENCY_PATTERNS) {
		const match = query.match(agencyPattern.pattern);
		if (match) {
			result.suggestedAgency = agencyPattern.code;
			result.suggestedAgencyName = agencyPattern.name;

			// Remove the agency mention from the query
			refinedQuery = refinedQuery.replace(agencyPattern.pattern, "").trim();

			detections.push(`agency: ${agencyPattern.name} (${agencyPattern.code})`);

			// High confidence if it's an exact abbreviation match
			if (match[0].toUpperCase() === agencyPattern.code) {
				result.confidence = "high";
			} else {
				result.confidence = "medium";
			}

			// Only match the first agency found
			break;
		}
	}

	// Check for NAICS codes
	const naicsMatches = Array.from(query.matchAll(NAICS_PATTERN));
	if (naicsMatches.length > 0) {
		// Get the last capture group (the actual number)
		const naicsCode = naicsMatches[0][2];
		result.suggestedNaics = naicsCode;

		// Remove NAICS mention from query
		refinedQuery = refinedQuery.replace(NAICS_PATTERN, "").trim();

		detections.push(`NAICS code: ${naicsCode}`);

		// Increase confidence if we also found an agency
		if (result.confidence === "medium") {
			result.confidence = "high";
		} else if (result.confidence === "low") {
			result.confidence = "medium";
		}
	}

	// Clean up the refined query
	refinedQuery = refinedQuery
		.replace(/\s+/g, " ") // Normalize whitespace
		.replace(/^[\s,-]+|[\s,-]+$/g, "") // Trim punctuation
		.trim();

	// Only set refinedQuery if it's different and not empty
	if (refinedQuery && refinedQuery !== query) {
		result.refinedQuery = refinedQuery;
	}

	// Generate helpful suggestion
	if (result.suggestedAgency || result.suggestedNaics) {
		result.suggestion = buildSuggestion(result);
	}

	return result;
}

/**
 * Builds a helpful suggestion message based on detected patterns
 */
function buildSuggestion(analysis: QueryAnalysis): string {
	const suggestions: string[] = [];

	if (analysis.suggestedAgency) {
		suggestions.push(
			`Use the 'awarding_agency' parameter with value '${analysis.suggestedAgency}' for more accurate agency filtering`,
		);
	}

	if (analysis.suggestedNaics) {
		suggestions.push(
			`Use the 'naics_code' parameter with value '${analysis.suggestedNaics}' to filter by industry classification`,
		);
	}

	if (
		analysis.refinedQuery &&
		analysis.refinedQuery !== analysis.originalQuery
	) {
		suggestions.push(
			`Use '${analysis.refinedQuery}' as your keyword search to avoid redundancy`,
		);
	}

	return suggestions.join(". ");
}

/**
 * Gets a list of all supported agency codes
 *
 * @returns Array of agency codes and names
 */
export function getSupportedAgencies(): Array<{ code: string; name: string }> {
	return AGENCY_PATTERNS.map((pattern) => ({
		code: pattern.code,
		name: pattern.name,
	}));
}

/**
 * Validates if a given string matches a known agency pattern
 *
 * @param agencyText - Text to check
 * @returns The matched agency code, or null if no match
 */
export function detectAgency(agencyText: string): string | null {
	for (const pattern of AGENCY_PATTERNS) {
		if (pattern.pattern.test(agencyText)) {
			return pattern.code;
		}
	}
	return null;
}

/**
 * Validates if a NAICS code has the correct format
 *
 * @param naics - NAICS code to validate
 * @returns True if valid (2-6 digits)
 */
export function isValidNaicsCode(naics: string): boolean {
	return /^\d{2,6}$/.test(naics);
}

/**
 * Extracts all agency mentions from text
 *
 * @param text - Text to analyze
 * @returns Array of detected agencies with their positions
 */
export function extractAgencies(
	text: string,
): Array<{ code: string; name: string; match: string }> {
	const agencies: Array<{ code: string; name: string; match: string }> = [];

	for (const pattern of AGENCY_PATTERNS) {
		const matches = Array.from(text.matchAll(pattern.pattern));
		for (const match of matches) {
			agencies.push({
				code: pattern.code,
				name: pattern.name,
				match: match[0],
			});
		}
	}

	return agencies;
}
