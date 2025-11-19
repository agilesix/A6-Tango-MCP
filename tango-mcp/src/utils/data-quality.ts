/**
 * Data Quality Warnings
 *
 * Provides transparent warnings about potential data quality issues
 * WITHOUT filtering or hiding any data. Users receive all data plus
 * warnings to help them make informed decisions.
 *
 * Philosophy: Expose issues honestly, let users decide.
 */

/**
 * Check forecast data quality and return warnings
 *
 * Warning types:
 * - Suspicious future dates (>10 years from now)
 * - Past award dates (opportunity may be stale)
 *
 * @param anticipated_award_date Award date from forecast (YYYY-MM-DD or null)
 * @returns Array of warning strings (empty if no issues)
 */
export function getForecastDataQualityWarnings(
	anticipated_award_date: string | null,
): string[] {
	const warnings: string[] = [];

	if (!anticipated_award_date) {
		return warnings; // No date = no date-based warnings
	}

	try {
		const awardDate = new Date(anticipated_award_date);
		const now = new Date();

		// Check if date is valid
		if (Number.isNaN(awardDate.getTime())) {
			warnings.push("Invalid award date format");
			return warnings;
		}

		// Calculate years from now
		const yearsFromNow =
			(awardDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

		// Warning: Suspicious future date (>10 years)
		if (yearsFromNow > 10) {
			const year = awardDate.getFullYear();
			warnings.push(
				`Suspicious award date (year ${year}) - likely data entry error in source system`,
			);
		}

		// Warning: Past date (may be stale)
		if (yearsFromNow < 0) {
			warnings.push(
				"Award date is in the past - forecast may be outdated or no longer active",
			);
		}
	} catch {
		warnings.push("Unable to parse award date");
	}

	return warnings;
}
