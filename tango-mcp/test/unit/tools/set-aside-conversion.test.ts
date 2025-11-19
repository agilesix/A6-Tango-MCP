/**
 * Unit Tests for Set-Aside Code Conversion
 *
 * Tests conversion logic for set_aside_type parameter to ensure:
 * 1. Comma-separated values are converted to pipe-separated (API format)
 * 2. Case normalization (lowercase/mixed case to uppercase)
 * 3. Valid formats are preserved unchanged
 * 4. Combined conversions work correctly
 * 5. Validation logic identifies recognized/unrecognized codes
 *
 * This mirrors the NAICS code conversion pattern for consistency.
 */

import { describe, it, expect } from "vitest";

/**
 * Helper function to convert set-aside values
 * Mirrors the implementation that should exist in tool handlers
 *
 * @param input - Set-aside value(s) from user input
 * @returns Normalized set-aside value for API
 */
function convertSetAsideValue(input: string): string {
	// Step 1: Comma-to-pipe conversion (API expects pipe-separated values)
	let value = input.includes(",")
		? input.replace(/,\s*/g, "|")
		: input;

	// Step 2: Case normalization (API expects uppercase codes)
	value = value.toUpperCase();

	return value;
}

/**
 * Recognized set-aside codes based on API documentation and test data
 * Source: test_set_aside_filter.md and Tango API documentation
 */
const RECOGNIZED_SET_ASIDE_CODES = [
	"NONE",     // Full & Open Competition
	"SBA",      // Total Small Business Set-Aside
	"SDVOSB",   // Service-Disabled Veteran-Owned (alias)
	"SDVOSBC",  // Service-Disabled Veteran-Owned Small Business Concern
	"SDVOSBS",  // Service-Disabled Veteran-Owned Small Business Self-Certified
	"VOSB",     // Veteran-Owned Small Business
	"VOSBC",    // Veteran-Owned Small Business Concern
	"WOSB",     // Women-Owned Small Business
	"EDWOSB",   // Economically Disadvantaged Women-Owned Small Business
	"8A",       // 8(a) Program
	"8AN",      // 8(a) Competitive
	"HZC",      // HUBZone
	"HZS",      // HUBZone Self-Certified
	"ISBEE",    // Indian Small Business Economic Enterprise
	"IEE",      // Indian Economic Enterprise
	"BICiv",    // Buy Indian - Civilian
	"BIDef",    // Buy Indian - Defense
	"RSB",      // Reserved for Small Business
	"LAS",      // Local Area Set-Aside
	"VET",      // Veteran-Owned
];

/**
 * Validation helper to check if codes are recognized
 *
 * @param value - Set-aside value (potentially pipe or comma separated)
 * @returns Object with validation results
 */
function validateSetAsideCodes(value: string): {
	allRecognized: boolean;
	recognizedCodes: string[];
	unrecognizedCodes: string[];
} {
	// Split on both pipe and comma to handle pre/post conversion
	const codes = value.split(/[|,]/).map((code) => code.trim().toUpperCase());

	const recognizedCodes: string[] = [];
	const unrecognizedCodes: string[] = [];

	for (const code of codes) {
		if (RECOGNIZED_SET_ASIDE_CODES.includes(code)) {
			recognizedCodes.push(code);
		} else {
			unrecognizedCodes.push(code);
		}
	}

	return {
		allRecognized: unrecognizedCodes.length === 0,
		recognizedCodes,
		unrecognizedCodes,
	};
}

describe("Set-Aside Code Conversion", () => {
	describe("comma-to-pipe conversion", () => {
		it("should convert comma-separated codes to pipe-separated", () => {
			const result = convertSetAsideValue("SDVOSB,VOSB");
			expect(result).toBe("SDVOSB|VOSB");
		});

		it("should convert comma-separated codes with spaces", () => {
			const result = convertSetAsideValue("SDVOSB, VOSB, WOSB");
			expect(result).toBe("SDVOSB|VOSB|WOSB");
		});

		it("should handle two codes with comma", () => {
			const result = convertSetAsideValue("SBA,8A");
			expect(result).toBe("SBA|8A");
		});

		it("should handle multiple codes with inconsistent spacing", () => {
			const result = convertSetAsideValue("SDVOSB,VOSB, WOSB,  HZC");
			expect(result).toBe("SDVOSB|VOSB|WOSB|HZC");
		});

		it("should handle comma at end (edge case)", () => {
			const result = convertSetAsideValue("SDVOSB,");
			expect(result).toBe("SDVOSB|");
		});

		it("should handle three veteran-related codes", () => {
			const result = convertSetAsideValue("SDVOSB,VOSB,VET");
			expect(result).toBe("SDVOSB|VOSB|VET");
		});
	});

	describe("case normalization", () => {
		it("should convert lowercase to uppercase", () => {
			const result = convertSetAsideValue("sdvosb");
			expect(result).toBe("SDVOSB");
		});

		it("should convert mixed case to uppercase", () => {
			const result = convertSetAsideValue("SdVoSb");
			expect(result).toBe("SDVOSB");
		});

		it("should normalize SBA lowercase", () => {
			const result = convertSetAsideValue("sba");
			expect(result).toBe("SBA");
		});

		it("should normalize 8a lowercase", () => {
			const result = convertSetAsideValue("8a");
			expect(result).toBe("8A");
		});

		it("should normalize WOSB mixed case", () => {
			const result = convertSetAsideValue("wOsB");
			expect(result).toBe("WOSB");
		});

		it("should normalize NONE lowercase", () => {
			const result = convertSetAsideValue("none");
			expect(result).toBe("NONE");
		});

		it("should normalize HZC variations", () => {
			expect(convertSetAsideValue("hzc")).toBe("HZC");
			expect(convertSetAsideValue("Hzc")).toBe("HZC");
			expect(convertSetAsideValue("hZc")).toBe("HZC");
		});
	});

	describe("format preservation", () => {
		it("should preserve pipe-separated format", () => {
			const result = convertSetAsideValue("SDVOSB|VOSB");
			expect(result).toBe("SDVOSB|VOSB");
		});

		it("should preserve single uppercase code", () => {
			const result = convertSetAsideValue("SDVOSB");
			expect(result).toBe("SDVOSB");
		});

		it("should preserve NONE value", () => {
			const result = convertSetAsideValue("NONE");
			expect(result).toBe("NONE");
		});

		it("should preserve already-correct multi-value format", () => {
			const result = convertSetAsideValue("SBA|WOSB|8A");
			expect(result).toBe("SBA|WOSB|8A");
		});

		it("should preserve 8A code format", () => {
			const result = convertSetAsideValue("8A");
			expect(result).toBe("8A");
		});

		it("should preserve complex multi-code format", () => {
			const result = convertSetAsideValue("SDVOSBC|VOSBC|WOSB|HZC");
			expect(result).toBe("SDVOSBC|VOSBC|WOSB|HZC");
		});
	});

	describe("combined conversions", () => {
		it("should apply comma conversion and case normalization together", () => {
			const result = convertSetAsideValue("sdvosb,vosb");
			expect(result).toBe("SDVOSB|VOSB");
		});

		it("should handle comma, space, and case conversions", () => {
			const result = convertSetAsideValue("Sba, 8a, Wosb");
			expect(result).toBe("SBA|8A|WOSB");
		});

		it("should normalize lowercase comma-separated codes", () => {
			const result = convertSetAsideValue("sdvosb, vosb, wosb");
			expect(result).toBe("SDVOSB|VOSB|WOSB");
		});

		it("should handle mixed case with spaces and commas", () => {
			const result = convertSetAsideValue("SdVoSb, VoSb, WoSb");
			expect(result).toBe("SDVOSB|VOSB|WOSB");
		});

		it("should normalize veteran codes with all transformations", () => {
			const result = convertSetAsideValue("sdvosbc, vosbc, vet");
			expect(result).toBe("SDVOSBC|VOSBC|VET");
		});

		it("should handle complex case with all code types", () => {
			const result = convertSetAsideValue("sba, 8a, wosb, hzc");
			expect(result).toBe("SBA|8A|WOSB|HZC");
		});
	});

	describe("edge cases", () => {
		it("should handle empty string", () => {
			const result = convertSetAsideValue("");
			expect(result).toBe("");
		});

		it("should handle single character code", () => {
			const result = convertSetAsideValue("a");
			expect(result).toBe("A");
		});

		it("should handle whitespace-only input", () => {
			const result = convertSetAsideValue("   ");
			expect(result).toBe("   ");
		});

		it("should handle multiple pipes (already separated)", () => {
			const result = convertSetAsideValue("SDVOSB||VOSB");
			expect(result).toBe("SDVOSB||VOSB");
		});

		it("should handle trailing/leading spaces in single value", () => {
			const result = convertSetAsideValue("  SDVOSB  ");
			expect(result).toBe("  SDVOSB  ");
		});

		it("should handle numeric codes like 8A", () => {
			const result = convertSetAsideValue("8a");
			expect(result).toBe("8A");
		});

		it("should handle long code sequences", () => {
			const result = convertSetAsideValue("sba,8a,wosb,edwosb,hzc,isbee");
			expect(result).toBe("SBA|8A|WOSB|EDWOSB|HZC|ISBEE");
		});
	});

	describe("real-world usage patterns", () => {
		it("should handle veteran business set-asides", () => {
			const result = convertSetAsideValue("SDVOSB,VOSB");
			expect(result).toBe("SDVOSB|VOSB");
		});

		it("should handle small business categories", () => {
			const result = convertSetAsideValue("sba,8a");
			expect(result).toBe("SBA|8A");
		});

		it("should handle women-owned categories", () => {
			const result = convertSetAsideValue("wosb,edwosb");
			expect(result).toBe("WOSB|EDWOSB");
		});

		it("should handle HUBZone variants", () => {
			const result = convertSetAsideValue("hzc,hzs");
			expect(result).toBe("HZC|HZS");
		});

		it("should handle Indian business categories", () => {
			const result = convertSetAsideValue("isbee,iee");
			expect(result).toBe("ISBEE|IEE");
		});

		it("should handle user-friendly lowercase input", () => {
			const result = convertSetAsideValue("none");
			expect(result).toBe("NONE");
		});

		it("should handle comprehensive veteran search", () => {
			const result = convertSetAsideValue("sdvosb, sdvosbc, sdvosbs, vosb, vosbc");
			expect(result).toBe("SDVOSB|SDVOSBC|SDVOSBS|VOSB|VOSBC");
		});
	});
});

describe("Set-Aside Code Validation", () => {
	describe("recognized codes", () => {
		it("should recognize SDVOSB as valid", () => {
			const validation = validateSetAsideCodes("SDVOSB");
			expect(validation.allRecognized).toBe(true);
			expect(validation.recognizedCodes).toEqual(["SDVOSB"]);
			expect(validation.unrecognizedCodes).toEqual([]);
		});

		it("should recognize SBA as valid", () => {
			const validation = validateSetAsideCodes("SBA");
			expect(validation.allRecognized).toBe(true);
			expect(validation.recognizedCodes).toEqual(["SBA"]);
		});

		it("should recognize 8A as valid", () => {
			const validation = validateSetAsideCodes("8A");
			expect(validation.allRecognized).toBe(true);
			expect(validation.recognizedCodes).toEqual(["8A"]);
		});

		it("should recognize WOSB as valid", () => {
			const validation = validateSetAsideCodes("WOSB");
			expect(validation.allRecognized).toBe(true);
			expect(validation.recognizedCodes).toEqual(["WOSB"]);
		});

		it("should recognize NONE as valid", () => {
			const validation = validateSetAsideCodes("NONE");
			expect(validation.allRecognized).toBe(true);
			expect(validation.recognizedCodes).toEqual(["NONE"]);
		});

		it("should recognize HZC as valid", () => {
			const validation = validateSetAsideCodes("HZC");
			expect(validation.allRecognized).toBe(true);
			expect(validation.recognizedCodes).toEqual(["HZC"]);
		});

		it("should recognize all veteran codes", () => {
			const validation = validateSetAsideCodes("SDVOSB|SDVOSBC|SDVOSBS|VOSB|VOSBC");
			expect(validation.allRecognized).toBe(true);
			expect(validation.recognizedCodes).toHaveLength(5);
		});
	});

	describe("unrecognized codes", () => {
		it("should identify INVALID as unrecognized", () => {
			const validation = validateSetAsideCodes("INVALID");
			expect(validation.allRecognized).toBe(false);
			expect(validation.unrecognizedCodes).toEqual(["INVALID"]);
		});

		it("should identify TYPO as unrecognized", () => {
			const validation = validateSetAsideCodes("TYPO");
			expect(validation.allRecognized).toBe(false);
			expect(validation.unrecognizedCodes).toEqual(["TYPO"]);
		});

		it("should identify SDVOB (missing S) as unrecognized", () => {
			const validation = validateSetAsideCodes("SDVOB");
			expect(validation.allRecognized).toBe(false);
			expect(validation.unrecognizedCodes).toEqual(["SDVOB"]);
		});

		it("should handle empty code as unrecognized", () => {
			const validation = validateSetAsideCodes("");
			expect(validation.allRecognized).toBe(false);
			expect(validation.unrecognizedCodes).toEqual([""]);
		});
	});

	describe("mixed valid/invalid codes", () => {
		it("should identify mix in pipe-separated format", () => {
			const validation = validateSetAsideCodes("SDVOSB|INVALID|WOSB");
			expect(validation.allRecognized).toBe(false);
			expect(validation.recognizedCodes).toEqual(["SDVOSB", "WOSB"]);
			expect(validation.unrecognizedCodes).toEqual(["INVALID"]);
		});

		it("should identify mix in comma-separated format", () => {
			const validation = validateSetAsideCodes("SBA,TYPO,8A");
			expect(validation.allRecognized).toBe(false);
			expect(validation.recognizedCodes).toEqual(["SBA", "8A"]);
			expect(validation.unrecognizedCodes).toEqual(["TYPO"]);
		});

		it("should handle lowercase mixed codes", () => {
			const validation = validateSetAsideCodes("sdvosb,invalid,wosb");
			expect(validation.allRecognized).toBe(false);
			expect(validation.recognizedCodes).toEqual(["SDVOSB", "WOSB"]);
			expect(validation.unrecognizedCodes).toEqual(["INVALID"]);
		});
	});

	describe("case insensitivity in validation", () => {
		it("should recognize lowercase codes", () => {
			const validation = validateSetAsideCodes("sdvosb");
			expect(validation.allRecognized).toBe(true);
			expect(validation.recognizedCodes).toEqual(["SDVOSB"]);
		});

		it("should recognize mixed case codes", () => {
			const validation = validateSetAsideCodes("SdVoSb");
			expect(validation.allRecognized).toBe(true);
			expect(validation.recognizedCodes).toEqual(["SDVOSB"]);
		});

		it("should handle case-insensitive validation of multiple codes", () => {
			const validation = validateSetAsideCodes("sba,8a,wosb");
			expect(validation.allRecognized).toBe(true);
			expect(validation.recognizedCodes).toEqual(["SBA", "8A", "WOSB"]);
		});
	});

	describe("splitting logic", () => {
		it("should split pipe-separated values correctly", () => {
			const validation = validateSetAsideCodes("SDVOSB|VOSB|WOSB");
			expect(validation.recognizedCodes).toHaveLength(3);
			expect(validation.recognizedCodes).toEqual(["SDVOSB", "VOSB", "WOSB"]);
		});

		it("should split comma-separated values correctly", () => {
			const validation = validateSetAsideCodes("SDVOSB,VOSB,WOSB");
			expect(validation.recognizedCodes).toHaveLength(3);
			expect(validation.recognizedCodes).toEqual(["SDVOSB", "VOSB", "WOSB"]);
		});

		it("should handle spaces in comma-separated values", () => {
			const validation = validateSetAsideCodes("SDVOSB, VOSB, WOSB");
			expect(validation.recognizedCodes).toHaveLength(3);
			expect(validation.recognizedCodes).toEqual(["SDVOSB", "VOSB", "WOSB"]);
		});

		it("should handle single value", () => {
			const validation = validateSetAsideCodes("SDVOSB");
			expect(validation.recognizedCodes).toHaveLength(1);
			expect(validation.recognizedCodes).toEqual(["SDVOSB"]);
		});
	});
});

describe("Integration: Conversion + Validation", () => {
	it("should convert and validate common user inputs", () => {
		const inputs = [
			"sdvosb,vosb",
			"SBA,8A",
			"wosb,edwosb",
			"none",
			"hzc|hzs",
		];

		for (const input of inputs) {
			const converted = convertSetAsideValue(input);
			const validation = validateSetAsideCodes(converted);
			expect(validation.allRecognized).toBe(true);
		}
	});

	it("should identify issues after conversion", () => {
		const input = "sdvosb,invalid,wosb";
		const converted = convertSetAsideValue(input);
		expect(converted).toBe("SDVOSB|INVALID|WOSB");

		const validation = validateSetAsideCodes(converted);
		expect(validation.allRecognized).toBe(false);
		expect(validation.unrecognizedCodes).toContain("INVALID");
	});

	it("should handle full workflow for valid codes", () => {
		const input = "sdvosb, vosb, wosb";

		// Step 1: Convert
		const converted = convertSetAsideValue(input);
		expect(converted).toBe("SDVOSB|VOSB|WOSB");

		// Step 2: Validate
		const validation = validateSetAsideCodes(converted);
		expect(validation.allRecognized).toBe(true);
		expect(validation.recognizedCodes).toHaveLength(3);
		expect(validation.unrecognizedCodes).toHaveLength(0);
	});

	it("should handle full workflow for mixed codes", () => {
		const input = "sba, TYPO, 8a, invalid";

		// Step 1: Convert
		const converted = convertSetAsideValue(input);
		expect(converted).toBe("SBA|TYPO|8A|INVALID");

		// Step 2: Validate
		const validation = validateSetAsideCodes(converted);
		expect(validation.allRecognized).toBe(false);
		expect(validation.recognizedCodes).toEqual(["SBA", "8A"]);
		expect(validation.unrecognizedCodes).toEqual(["TYPO", "INVALID"]);
	});
});
