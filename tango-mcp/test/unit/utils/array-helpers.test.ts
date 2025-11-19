import { describe, it, expect } from "vitest";
import {
	toPipeDelimitedString,
	toUppercasePipeString,
	parseMultiValueParam,
} from "@/utils/array-helpers";

describe("toPipeDelimitedString", () => {
	describe("real arrays", () => {
		it("converts string array to pipe-delimited", () => {
			expect(toPipeDelimitedString(["541512", "541511"])).toBe(
				"541512|541511",
			);
		});

		it("handles single-item array", () => {
			expect(toPipeDelimitedString(["541512"])).toBe("541512");
		});

		it("handles empty array", () => {
			expect(toPipeDelimitedString([])).toBeUndefined();
		});

		it("filters out null and undefined items", () => {
			expect(toPipeDelimitedString(["541512", null, "541511", undefined])).toBe(
				"541512|541511",
			);
		});

		it("trims whitespace from array items", () => {
			expect(toPipeDelimitedString([" 541512 ", "541511"])).toBe(
				"541512|541511",
			);
		});

		it("converts non-string array items to strings", () => {
			expect(toPipeDelimitedString([541512, 541511])).toBe("541512|541511");
		});

		it("filters out empty strings after trimming", () => {
			expect(toPipeDelimitedString(["541512", "  ", "541511"])).toBe(
				"541512|541511",
			);
		});
	});

	describe("JSON-stringified arrays", () => {
		it("parses and converts JSON array string", () => {
			expect(toPipeDelimitedString('["541512","541511"]')).toBe(
				"541512|541511",
			);
		});

		it("handles JSON with spaces", () => {
			expect(toPipeDelimitedString('[ "541512" , "541511" ]')).toBe(
				"541512|541511",
			);
		});

		it("handles single-item JSON array", () => {
			expect(toPipeDelimitedString('["541512"]')).toBe("541512");
		});

		it("handles empty JSON array", () => {
			expect(toPipeDelimitedString("[]")).toBeUndefined();
		});

		it("handles JSON array with numbers", () => {
			expect(toPipeDelimitedString("[541512,541511]")).toBe("541512|541511");
		});

		it("treats invalid JSON as literal string", () => {
			expect(toPipeDelimitedString("[invalid")).toBe("[invalid");
		});

		it("treats non-array JSON as literal string", () => {
			expect(toPipeDelimitedString('{"key":"value"}')).toBe('{"key":"value"}');
		});

		it("handles escaped quotes in JSON", () => {
			expect(toPipeDelimitedString('[\"541512\",\"541511\"]')).toBe(
				"541512|541511",
			);
		});

		it("handles JSON array with null values", () => {
			expect(toPipeDelimitedString('["541512",null,"541511"]')).toBe(
				"541512|541511",
			);
		});
	});

	describe("comma-separated strings", () => {
		it("converts comma-separated to pipe-delimited", () => {
			expect(toPipeDelimitedString("541512,541511")).toBe("541512|541511");
		});

		it("handles spaces around commas", () => {
			expect(toPipeDelimitedString("541512, 541511")).toBe("541512|541511");
			expect(toPipeDelimitedString("541512 , 541511")).toBe("541512|541511");
		});

		it("handles multiple commas", () => {
			expect(toPipeDelimitedString("541512,541511,541519")).toBe(
				"541512|541511|541519",
			);
		});

		it("filters out empty items between commas", () => {
			expect(toPipeDelimitedString("541512,,541511")).toBe("541512|541511");
		});

		it("handles trailing comma", () => {
			expect(toPipeDelimitedString("541512,541511,")).toBe("541512|541511");
		});

		it("handles leading comma", () => {
			expect(toPipeDelimitedString(",541512,541511")).toBe("541512|541511");
		});
	});

	describe("pipe-separated strings", () => {
		it("returns pipe-separated string as-is", () => {
			expect(toPipeDelimitedString("541512|541511")).toBe("541512|541511");
		});

		it("trims whitespace", () => {
			expect(toPipeDelimitedString(" 541512|541511 ")).toBe("541512|541511");
		});

		it("handles multiple pipe characters", () => {
			expect(toPipeDelimitedString("541512|541511|541519")).toBe(
				"541512|541511|541519",
			);
		});
	});

	describe("single values", () => {
		it("returns single string value as-is", () => {
			expect(toPipeDelimitedString("541512")).toBe("541512");
		});

		it("trims whitespace", () => {
			expect(toPipeDelimitedString("  541512  ")).toBe("541512");
		});

		it("converts numbers to strings", () => {
			expect(toPipeDelimitedString(541512)).toBe("541512");
		});
	});

	describe("edge cases", () => {
		it("handles null", () => {
			expect(toPipeDelimitedString(null)).toBeUndefined();
		});

		it("handles undefined", () => {
			expect(toPipeDelimitedString(undefined)).toBeUndefined();
		});

		it("handles empty string", () => {
			expect(toPipeDelimitedString("")).toBeUndefined();
		});

		it("handles whitespace-only string", () => {
			expect(toPipeDelimitedString("   ")).toBeUndefined();
		});

		it("converts booleans to strings", () => {
			expect(toPipeDelimitedString(true)).toBe("true");
			expect(toPipeDelimitedString(false)).toBe("false");
		});

		it("handles objects by converting to string", () => {
			expect(toPipeDelimitedString({ key: "value" })).toBe(
				"[object Object]",
			);
		});

		it("handles zero", () => {
			expect(toPipeDelimitedString(0)).toBe("0");
		});

		it("handles negative numbers", () => {
			expect(toPipeDelimitedString(-123)).toBe("-123");
		});
	});
});

describe("toUppercasePipeString", () => {
	it("converts array to uppercase pipe-delimited", () => {
		expect(toUppercasePipeString(["a", "b", "c"])).toBe("A|B|C");
	});

	it("converts comma-separated to uppercase pipe-delimited", () => {
		expect(toUppercasePipeString("8a,sdvosb,wosb")).toBe("8A|SDVOSB|WOSB");
	});

	it("converts JSON array to uppercase pipe-delimited", () => {
		expect(toUppercasePipeString('["8a","sdvosb"]')).toBe("8A|SDVOSB");
	});

	it("handles mixed case input", () => {
		expect(toUppercasePipeString("SBA|8a|HuBzOnE")).toBe("SBA|8A|HUBZONE");
	});

	it("handles single lowercase value", () => {
		expect(toUppercasePipeString("sba")).toBe("SBA");
	});

	it("returns undefined for null", () => {
		expect(toUppercasePipeString(null)).toBeUndefined();
	});

	it("returns undefined for undefined", () => {
		expect(toUppercasePipeString(undefined)).toBeUndefined();
	});

	it("returns undefined for empty string", () => {
		expect(toUppercasePipeString("")).toBeUndefined();
	});

	it("handles pipe-separated lowercase", () => {
		expect(toUppercasePipeString("a|b|c")).toBe("A|B|C");
	});

	it("handles numbers in strings", () => {
		expect(toUppercasePipeString("8a,hubzone")).toBe("8A|HUBZONE");
	});
});

describe("parseMultiValueParam", () => {
	it("parses array into array of strings", () => {
		expect(parseMultiValueParam(["541512", "541511"])).toEqual([
			"541512",
			"541511",
		]);
	});

	it("parses JSON array string", () => {
		expect(parseMultiValueParam('["541512","541511"]')).toEqual([
			"541512",
			"541511",
		]);
	});

	it("parses comma-separated string", () => {
		expect(parseMultiValueParam("541512,541511")).toEqual([
			"541512",
			"541511",
		]);
	});

	it("parses pipe-separated string", () => {
		expect(parseMultiValueParam("541512|541511")).toEqual([
			"541512",
			"541511",
		]);
	});

	it("returns single-item array for single value", () => {
		expect(parseMultiValueParam("541512")).toEqual(["541512"]);
	});

	it("returns undefined for null", () => {
		expect(parseMultiValueParam(null)).toBeUndefined();
	});

	it("returns undefined for empty string", () => {
		expect(parseMultiValueParam("")).toBeUndefined();
	});

	it("filters out empty items", () => {
		expect(parseMultiValueParam("541512||541511")).toEqual([
			"541512",
			"541511",
		]);
	});

	it("returns undefined for undefined", () => {
		expect(parseMultiValueParam(undefined)).toBeUndefined();
	});

	it("handles multiple values with whitespace", () => {
		expect(parseMultiValueParam(" 541512 , 541511 ")).toEqual([
			"541512",
			"541511",
		]);
	});

	it("handles JSON array with numbers", () => {
		expect(parseMultiValueParam("[541512,541511]")).toEqual([
			"541512",
			"541511",
		]);
	});

	it("handles three values", () => {
		expect(parseMultiValueParam("541512,541511,541519")).toEqual([
			"541512",
			"541511",
			"541519",
		]);
	});

	it("returns undefined for empty array", () => {
		expect(parseMultiValueParam([])).toBeUndefined();
	});
});
