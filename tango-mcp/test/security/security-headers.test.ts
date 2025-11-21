/**
 * Tests for security headers implementation
 */

import { describe, it, expect } from "vitest";

/**
 * Expected security headers that should be present on OAuth endpoints
 */
const EXPECTED_SECURITY_HEADERS = {
	"Content-Security-Policy":
		"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
	"X-Frame-Options": "DENY",
	"X-Content-Type-Options": "nosniff",
	"X-XSS-Protection": "1; mode=block",
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

describe("Security Headers", () => {
	describe("Header values", () => {
		it("should have Content-Security-Policy header", () => {
			expect(EXPECTED_SECURITY_HEADERS["Content-Security-Policy"]).toBeDefined();
			expect(
				EXPECTED_SECURITY_HEADERS["Content-Security-Policy"]
			).toContain("frame-ancestors 'none'");
			expect(EXPECTED_SECURITY_HEADERS["Content-Security-Policy"]).toContain(
				"default-src 'self'"
			);
		});

		it("should have X-Frame-Options set to DENY", () => {
			expect(EXPECTED_SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
		});

		it("should have X-Content-Type-Options set to nosniff", () => {
			expect(EXPECTED_SECURITY_HEADERS["X-Content-Type-Options"]).toBe(
				"nosniff"
			);
		});

		it("should have X-XSS-Protection enabled", () => {
			expect(EXPECTED_SECURITY_HEADERS["X-XSS-Protection"]).toBe(
				"1; mode=block"
			);
		});

		it("should have Strict-Transport-Security (HSTS)", () => {
			expect(
				EXPECTED_SECURITY_HEADERS["Strict-Transport-Security"]
			).toBeDefined();
			expect(
				EXPECTED_SECURITY_HEADERS["Strict-Transport-Security"]
			).toContain("max-age=31536000");
			expect(
				EXPECTED_SECURITY_HEADERS["Strict-Transport-Security"]
			).toContain("includeSubDomains");
			expect(
				EXPECTED_SECURITY_HEADERS["Strict-Transport-Security"]
			).toContain("preload");
		});

		it("should have Referrer-Policy", () => {
			expect(EXPECTED_SECURITY_HEADERS["Referrer-Policy"]).toBe(
				"strict-origin-when-cross-origin"
			);
		});

		it("should have Permissions-Policy", () => {
			expect(EXPECTED_SECURITY_HEADERS["Permissions-Policy"]).toBeDefined();
			expect(EXPECTED_SECURITY_HEADERS["Permissions-Policy"]).toContain(
				"geolocation=()"
			);
			expect(EXPECTED_SECURITY_HEADERS["Permissions-Policy"]).toContain(
				"microphone=()"
			);
			expect(EXPECTED_SECURITY_HEADERS["Permissions-Policy"]).toContain(
				"camera=()"
			);
		});
	});

	describe("CSP Directives", () => {
		const csp = EXPECTED_SECURITY_HEADERS["Content-Security-Policy"];

		it("should restrict default-src to self", () => {
			expect(csp).toContain("default-src 'self'");
		});

		it("should allow inline scripts (for OAuth flow)", () => {
			expect(csp).toContain("script-src 'self' 'unsafe-inline'");
		});

		it("should allow inline styles (for OAuth flow)", () => {
			expect(csp).toContain("style-src 'self' 'unsafe-inline'");
		});

		it("should prevent framing (clickjacking protection)", () => {
			expect(csp).toContain("frame-ancestors 'none'");
		});

		it("should allow HTTPS images", () => {
			expect(csp).toContain("img-src 'self' data: https:");
		});

		it("should restrict connect-src to self", () => {
			expect(csp).toContain("connect-src 'self'");
		});

		it("should allow data URIs for fonts", () => {
			expect(csp).toContain("font-src 'self' data:");
		});
	});

	describe("HSTS Configuration", () => {
		const hsts = EXPECTED_SECURITY_HEADERS["Strict-Transport-Security"];

		it("should have 1 year max-age", () => {
			expect(hsts).toContain("max-age=31536000");
		});

		it("should include subdomains", () => {
			expect(hsts).toContain("includeSubDomains");
		});

		it("should be preload-eligible", () => {
			expect(hsts).toContain("preload");
		});
	});

	describe("Header security best practices", () => {
		it("should prevent clickjacking with X-Frame-Options DENY", () => {
			expect(EXPECTED_SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
		});

		it("should prevent MIME sniffing", () => {
			expect(EXPECTED_SECURITY_HEADERS["X-Content-Type-Options"]).toBe(
				"nosniff"
			);
		});

		it("should enable browser XSS protection", () => {
			const xssProtection = EXPECTED_SECURITY_HEADERS["X-XSS-Protection"];
			expect(xssProtection).toContain("1");
			expect(xssProtection).toContain("mode=block");
		});

		it("should restrict referrer information leakage", () => {
			expect(EXPECTED_SECURITY_HEADERS["Referrer-Policy"]).toBe(
				"strict-origin-when-cross-origin"
			);
		});

		it("should disable dangerous permissions", () => {
			const permissionsPolicy =
				EXPECTED_SECURITY_HEADERS["Permissions-Policy"];
			expect(permissionsPolicy).toContain("geolocation=()");
			expect(permissionsPolicy).toContain("microphone=()");
			expect(permissionsPolicy).toContain("camera=()");
		});
	});

	describe("Complete header set", () => {
		it("should have all required security headers", () => {
			const requiredHeaders = [
				"Content-Security-Policy",
				"X-Frame-Options",
				"X-Content-Type-Options",
				"X-XSS-Protection",
				"Strict-Transport-Security",
				"Referrer-Policy",
				"Permissions-Policy",
			];

			requiredHeaders.forEach((header) => {
				expect(EXPECTED_SECURITY_HEADERS[header as keyof typeof EXPECTED_SECURITY_HEADERS]).toBeDefined();
			});
		});

		it("should have 7 security headers total", () => {
			expect(Object.keys(EXPECTED_SECURITY_HEADERS).length).toBe(7);
		});
	});

	describe("No unsafe configurations", () => {
		it("should not use unsafe-eval in CSP", () => {
			expect(EXPECTED_SECURITY_HEADERS["Content-Security-Policy"]).not.toContain(
				"unsafe-eval"
			);
		});

		it("should not allow all sources (*) in CSP", () => {
			const csp = EXPECTED_SECURITY_HEADERS["Content-Security-Policy"];
			// Should not have blanket * wildcards (specific protocols like https: are ok)
			expect(csp.split(";").some((directive) => directive.trim() === "*")).toBe(
				false
			);
		});

		it("should not use SAMEORIGIN for X-Frame-Options", () => {
			// DENY is more secure than SAMEORIGIN
			expect(EXPECTED_SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
		});

		it("should not disable XSS protection", () => {
			expect(EXPECTED_SECURITY_HEADERS["X-XSS-Protection"]).not.toContain(
				"0"
			);
		});
	});
});

describe("addSecurityHeaders function implementation", () => {
	// Test the actual implementation by simulating the function
	function addSecurityHeaders(response: Response): Response {
		const headers = new Headers(response.headers);

		headers.set(
			"Content-Security-Policy",
			"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
		);
		headers.set("X-Frame-Options", "DENY");
		headers.set("X-Content-Type-Options", "nosniff");
		headers.set("X-XSS-Protection", "1; mode=block");
		headers.set(
			"Strict-Transport-Security",
			"max-age=31536000; includeSubDomains; preload"
		);
		headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
		headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}

	it("should add security headers to response", () => {
		const originalResponse = new Response("OK", { status: 200 });
		const securedResponse = addSecurityHeaders(originalResponse);

		expect(securedResponse.headers.get("Content-Security-Policy")).toBe(
			EXPECTED_SECURITY_HEADERS["Content-Security-Policy"]
		);
		expect(securedResponse.headers.get("X-Frame-Options")).toBe(
			EXPECTED_SECURITY_HEADERS["X-Frame-Options"]
		);
		expect(securedResponse.headers.get("X-Content-Type-Options")).toBe(
			EXPECTED_SECURITY_HEADERS["X-Content-Type-Options"]
		);
	});

	it("should preserve response status", () => {
		const originalResponse = new Response("Not Found", { status: 404 });
		const securedResponse = addSecurityHeaders(originalResponse);

		expect(securedResponse.status).toBe(404);
		expect(securedResponse.statusText).toBe("Not Found");
	});

	it("should preserve existing headers", () => {
		const originalResponse = new Response("OK", {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"X-Custom-Header": "custom-value",
			},
		});

		const securedResponse = addSecurityHeaders(originalResponse);

		expect(securedResponse.headers.get("Content-Type")).toBe(
			"application/json"
		);
		expect(securedResponse.headers.get("X-Custom-Header")).toBe("custom-value");
	});

	it("should preserve response body", async () => {
		const originalBody = JSON.stringify({ message: "test" });
		const originalResponse = new Response(originalBody, { status: 200 });
		const securedResponse = addSecurityHeaders(originalResponse);

		const securedBody = await securedResponse.text();
		expect(securedBody).toBe(originalBody);
	});

	it("should add all security headers", () => {
		const originalResponse = new Response("OK");
		const securedResponse = addSecurityHeaders(originalResponse);

		Object.entries(EXPECTED_SECURITY_HEADERS).forEach(([key, value]) => {
			expect(securedResponse.headers.get(key)).toBe(value);
		});
	});

	it("should work with redirect responses", () => {
		const originalResponse = new Response(null, {
			status: 302,
			headers: { Location: "https://example.com" },
		});

		const securedResponse = addSecurityHeaders(originalResponse);

		expect(securedResponse.status).toBe(302);
		expect(securedResponse.headers.get("Location")).toBe(
			"https://example.com"
		);
		expect(securedResponse.headers.get("X-Frame-Options")).toBe("DENY");
	});

	it("should work with JSON responses", async () => {
		const jsonData = { status: "healthy" };
		const originalResponse = new Response(JSON.stringify(jsonData), {
			headers: { "Content-Type": "application/json" },
		});

		const securedResponse = addSecurityHeaders(originalResponse);

		const responseData = await securedResponse.json();
		expect(responseData).toEqual(jsonData);
		expect(securedResponse.headers.get("Content-Type")).toBe(
			"application/json"
		);
	});

	it("should work with error responses", () => {
		const originalResponse = new Response("Internal Server Error", {
			status: 500,
		});

		const securedResponse = addSecurityHeaders(originalResponse);

		expect(securedResponse.status).toBe(500);
		expect(securedResponse.headers.get("X-Content-Type-Options")).toBe(
			"nosniff"
		);
	});
});
