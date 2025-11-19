/**
 * Data Quality Warnings Tests
 */

import { describe, expect, it } from "vitest";
import { getForecastDataQualityWarnings } from "@/utils/data-quality";

describe("getForecastDataQualityWarnings", () => {
	describe("valid dates", () => {
		it("should return no warnings for reasonable future dates", () => {
			const nextYear = new Date();
			nextYear.setFullYear(nextYear.getFullYear() + 2);
			const dateStr = nextYear.toISOString().split("T")[0];

			const warnings = getForecastDataQualityWarnings(dateStr);

			expect(warnings).toEqual([]);
		});

		it("should return no warnings for null dates", () => {
			const warnings = getForecastDataQualityWarnings(null);

			expect(warnings).toEqual([]);
		});
	});

	describe("suspicious future dates", () => {
		it("should warn about dates more than 10 years in the future", () => {
			const warnings = getForecastDataQualityWarnings("3025-01-01");

			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain("Suspicious award date");
			expect(warnings[0]).toMatch(/year \d{4}/); // Match any 4-digit year
			expect(warnings[0]).toContain("data entry error");
		});

		it("should warn about year 2206 dates", () => {
			const warnings = getForecastDataQualityWarnings("2206-06-15");

			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain("Suspicious award date");
			expect(warnings[0]).toContain("year 2206");
		});
	});

	describe("past dates", () => {
		it("should warn about dates in the past", () => {
			const warnings = getForecastDataQualityWarnings("2020-01-01");

			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain("Award date is in the past");
			expect(warnings[0]).toContain("outdated");
		});
	});

	describe("invalid dates", () => {
		it("should warn about invalid date format", () => {
			const warnings = getForecastDataQualityWarnings("not-a-date");

			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain("Invalid award date format");
		});
	});
});
