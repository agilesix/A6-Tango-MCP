import type {
	AuthRequest,
	OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { getAuditLogger } from "../security/audit-logging.js";
import {
	applyRateLimit,
	createRateLimiters,
	getClientIP,
} from "../security/rate-limiting.js";
import type { Env } from "../types/env.js";
import {
	fetchUpstreamAuthToken,
	getUpstreamAuthorizeUrl,
	type Props,
} from "./utils";
import {
	addApprovedClient,
	bindStateToSession,
	createOAuthState,
	generateCSRFProtection,
	isClientApproved,
	OAuthError,
	renderApprovalDialog,
	validateCSRFToken,
	validateOAuthState,
} from "./workers-oauth-utils";

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();

/**
 * Security headers middleware
 * Applied to all OAuth endpoints for security hardening
 */
function addSecurityHeaders(response: Response): Response {
	const headers = new Headers(response.headers);

	// Content Security Policy - Prevent XSS attacks
	headers.set(
		"Content-Security-Policy",
		"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
	);

	// Prevent clickjacking
	headers.set("X-Frame-Options", "DENY");

	// Prevent MIME type sniffing
	headers.set("X-Content-Type-Options", "nosniff");

	// Enable XSS protection (legacy browsers)
	headers.set("X-XSS-Protection", "1; mode=block");

	// Force HTTPS (HSTS)
	headers.set(
		"Strict-Transport-Security",
		"max-age=31536000; includeSubDomains; preload",
	);

	// Referrer policy
	headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

	// Permissions policy
	headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

app.get("/authorize", async (c) => {
	const auditLogger = getAuditLogger();
	const clientIP = getClientIP(c.req.raw);

	// Apply rate limiting
	try {
		const rateLimiters = createRateLimiters(c.env);
		const rateLimitResponse = await applyRateLimit(rateLimiters.auth, clientIP);
		if (rateLimitResponse) {
			await auditLogger.logRateLimitViolation(
				"auth_endpoint",
				clientIP,
				c.req.raw,
				0,
				0,
			);
			return addSecurityHeaders(rateLimitResponse);
		}
	} catch (error) {
		console.error("Rate limiting error:", error);
		// Continue without rate limiting if there's an error
	}

	const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
	const { clientId } = oauthReqInfo;
	if (!clientId) {
		await auditLogger.logSecurityEvent(
			"invalid_oauth_request",
			"warning",
			c.req.raw,
			{ reason: "missing_client_id" },
		);
		return addSecurityHeaders(c.text("Invalid request", 400));
	}

	// Validate required OAuth environment variables
	if (!c.env.COOKIE_ENCRYPTION_KEY || !c.env.OAUTH_KV) {
		return addSecurityHeaders(
			c.text(
				"OAuth not configured - missing COOKIE_ENCRYPTION_KEY or OAUTH_KV",
				500,
			),
		);
	}

	// Check if client is already approved
	if (
		await isClientApproved(c.req.raw, clientId, c.env.COOKIE_ENCRYPTION_KEY)
	) {
		// Skip approval dialog but still create secure state and bind to session
		const { stateToken } = await createOAuthState(oauthReqInfo, c.env.OAUTH_KV);
		const { setCookie: sessionBindingCookie } =
			await bindStateToSession(stateToken);
		const response = await redirectToGoogle(c.req.raw, c.env, stateToken, {
			"Set-Cookie": sessionBindingCookie,
		});
		return addSecurityHeaders(response);
	}

	// Generate CSRF protection for the approval form
	const { token: csrfToken, setCookie } = generateCSRFProtection();

	const response = await renderApprovalDialog(c.req.raw, {
		client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
		csrfToken,
		server: {
			description:
				"Access government contracting data, grants, opportunities, and vendor intelligence through the Tango API.",
			name: "Tango MCP Server",
		},
		setCookie,
		state: { oauthReqInfo },
	});

	return addSecurityHeaders(response);
});

app.post("/authorize", async (c) => {
	const auditLogger = getAuditLogger();
	const clientIP = getClientIP(c.req.raw);

	try {
		// Apply rate limiting
		try {
			const rateLimiters = createRateLimiters(c.env);
			const rateLimitResponse = await applyRateLimit(
				rateLimiters.auth,
				clientIP,
			);
			if (rateLimitResponse) {
				await auditLogger.logRateLimitViolation(
					"auth_endpoint",
					clientIP,
					c.req.raw,
					0,
					0,
				);
				return addSecurityHeaders(rateLimitResponse);
			}
		} catch (error) {
			console.error("Rate limiting error:", error);
		}

		// Validate required OAuth environment variables
		if (!c.env.COOKIE_ENCRYPTION_KEY || !c.env.OAUTH_KV) {
			return addSecurityHeaders(
				c.text(
					"OAuth not configured - missing COOKIE_ENCRYPTION_KEY or OAUTH_KV",
					500,
				),
			);
		}

		// Read form data once
		const formData = await c.req.raw.formData();

		// Validate CSRF token
		try {
			validateCSRFToken(formData, c.req.raw);
		} catch (error) {
			await auditLogger.logCSRFFailure(c.req.raw);
			throw error;
		}

		// Extract state from form data
		const encodedState = formData.get("state");
		if (!encodedState || typeof encodedState !== "string") {
			return c.text("Missing state in form data", 400);
		}

		let state: { oauthReqInfo?: AuthRequest };
		try {
			state = JSON.parse(atob(encodedState));
		} catch (_e) {
			return c.text("Invalid state data", 400);
		}

		if (!state.oauthReqInfo || !state.oauthReqInfo.clientId) {
			return c.text("Invalid request", 400);
		}

		// Add client to approved list
		const approvedClientCookie = await addApprovedClient(
			c.req.raw,
			state.oauthReqInfo.clientId,
			c.env.COOKIE_ENCRYPTION_KEY,
		);

		// Create OAuth state and bind it to this user's session
		const { stateToken } = await createOAuthState(
			state.oauthReqInfo,
			c.env.OAUTH_KV,
		);
		const { setCookie: sessionBindingCookie } =
			await bindStateToSession(stateToken);

		// Set both cookies: approved client list + session binding
		const headers = new Headers();
		headers.append("Set-Cookie", approvedClientCookie);
		headers.append("Set-Cookie", sessionBindingCookie);

		const response = await redirectToGoogle(
			c.req.raw,
			c.env,
			stateToken,
			Object.fromEntries(headers),
		);
		return addSecurityHeaders(response);
	} catch (error: any) {
		console.error("POST /authorize error:", error);
		if (error instanceof OAuthError) {
			return addSecurityHeaders(error.toResponse());
		}
		// Unexpected non-OAuth error
		return addSecurityHeaders(
			c.text(`Internal server error: ${error.message}`, 500),
		);
	}
});

async function redirectToGoogle(
	request: Request,
	env: Env,
	stateToken: string,
	headers: Record<string, string> = {},
) {
	if (!env.GOOGLE_CLIENT_ID) {
		throw new Error("GOOGLE_CLIENT_ID not configured");
	}

	return new Response(null, {
		headers: {
			...headers,
			location: getUpstreamAuthorizeUrl({
				clientId: env.GOOGLE_CLIENT_ID,
				hostedDomain: env.HOSTED_DOMAIN,
				redirectUri: new URL("/callback", request.url).href,
				scope: "email profile",
				state: stateToken,
				upstreamUrl: "https://accounts.google.com/o/oauth2/v2/auth",
			}),
		},
		status: 302,
	});
}

/**
 * OAuth Callback Endpoint
 *
 * This route handles the callback from Google after user authentication.
 * It exchanges the temporary code for an access token, then stores some
 * user metadata & the auth token as part of the 'props' on the token passed
 * down to the client. It ends by redirecting the client back to _its_ callback URL
 *
 * SECURITY: This endpoint validates that the state parameter from Google
 * matches both:
 * 1. A valid state token in KV (proves it was created by our server)
 * 2. The __Host-CONSENTED_STATE cookie (proves THIS browser consented to it)
 *
 * This prevents CSRF attacks where an attacker's state token is injected
 * into a victim's OAuth flow.
 */
app.get("/callback", async (c) => {
	const auditLogger = getAuditLogger();
	const clientIP = getClientIP(c.req.raw);

	// Apply rate limiting
	try {
		const rateLimiters = createRateLimiters(c.env);
		const rateLimitResponse = await applyRateLimit(rateLimiters.auth, clientIP);
		if (rateLimitResponse) {
			await auditLogger.logRateLimitViolation(
				"auth_endpoint",
				clientIP,
				c.req.raw,
				0,
				0,
			);
			return addSecurityHeaders(rateLimitResponse);
		}
	} catch (error) {
		console.error("Rate limiting error:", error);
	}

	// Validate required OAuth environment variables
	if (
		!c.env.OAUTH_KV ||
		!c.env.GOOGLE_CLIENT_ID ||
		!c.env.GOOGLE_CLIENT_SECRET
	) {
		return addSecurityHeaders(
			c.text(
				"OAuth not configured - missing required environment variables",
				500,
			),
		);
	}

	// Validate OAuth state with session binding
	// This checks both KV storage AND the session cookie
	let oauthReqInfo: AuthRequest;
	let clearSessionCookie: string;

	try {
		const result = await validateOAuthState(c.req.raw, c.env.OAUTH_KV);
		oauthReqInfo = result.oauthReqInfo;
		clearSessionCookie = result.clearCookie;
	} catch (error: any) {
		await auditLogger.logOAuthStateFailure(
			error instanceof OAuthError ? error.message : "Unknown error",
			c.req.raw,
		);
		if (error instanceof OAuthError) {
			return addSecurityHeaders(error.toResponse());
		}
		// Unexpected non-OAuth error
		return addSecurityHeaders(c.text("Internal server error", 500));
	}

	if (!oauthReqInfo.clientId) {
		await auditLogger.logSecurityEvent(
			"invalid_oauth_callback",
			"warning",
			c.req.raw,
			{ reason: "missing_client_id" },
		);
		return addSecurityHeaders(c.text("Invalid OAuth request data", 400));
	}

	// Exchange the code for an access token
	const code = c.req.query("code");
	if (!code) {
		await auditLogger.logSecurityEvent(
			"invalid_oauth_callback",
			"warning",
			c.req.raw,
			{ reason: "missing_code" },
		);
		return addSecurityHeaders(c.text("Missing code", 400));
	}

	const [accessToken, googleErrResponse] = await fetchUpstreamAuthToken({
		clientId: c.env.GOOGLE_CLIENT_ID,
		clientSecret: c.env.GOOGLE_CLIENT_SECRET,
		code,
		grantType: "authorization_code",
		redirectUri: new URL("/callback", c.req.url).href,
		upstreamUrl: "https://accounts.google.com/o/oauth2/token",
	});
	if (googleErrResponse) {
		await auditLogger.logOAuthCallback(
			false,
			undefined,
			c.req.raw,
			"Failed to exchange code for token",
		);
		return addSecurityHeaders(googleErrResponse);
	}

	// Fetch the user info from Google
	const userResponse = await fetch(
		"https://www.googleapis.com/oauth2/v2/userinfo",
		{
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		},
	);
	if (!userResponse.ok) {
		const errorText = await userResponse.text();
		await auditLogger.logOAuthCallback(
			false,
			undefined,
			c.req.raw,
			`Failed to fetch user info: ${errorText}`,
		);
		return addSecurityHeaders(
			c.text(`Failed to fetch user info: ${errorText}`, 500),
		);
	}

	const { id, name, email } = (await userResponse.json()) as {
		id: string;
		name: string;
		email: string;
	};

	// Log successful OAuth callback
	await auditLogger.logOAuthCallback(true, email, c.req.raw);

	// Return back to the MCP client a new token
	const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
		metadata: {
			label: name,
		},
		props: {
			accessToken,
			email,
			name,
		} as Props,
		request: oauthReqInfo,
		scope: oauthReqInfo.scope,
		userId: id,
	});

	// Clear the session binding cookie (one-time use) by creating response with headers
	const headers = new Headers({ Location: redirectTo });
	if (clearSessionCookie) {
		headers.set("Set-Cookie", clearSessionCookie);
	}

	const response = new Response(null, {
		status: 302,
		headers,
	});

	return addSecurityHeaders(response);
});

/**
 * Health check endpoint (public, no auth required)
 *
 * Enhanced with authentication configuration status for Gateway Model.
 * Shows which authentication methods are configured and available.
 */
app.get("/health", async (c) => {
	const env = c.env;

	// Check OAuth configuration
	const oauthConfigured = !!(
		env.GOOGLE_CLIENT_ID &&
		env.GOOGLE_CLIENT_SECRET &&
		env.COOKIE_ENCRYPTION_KEY
	);

	// Check Tango API configuration
	const tangoApiConfigured = !!env.TANGO_API_KEY;

	// Check MCP token system
	const mcpTokenSystemEnabled = !!env.OAUTH_KV;

	// Get require authentication setting
	const requireAuth = env.REQUIRE_AUTHENTICATION !== "false";

	const response = c.json({
		status: "healthy",
		service: "tango-mcp",
		version: "1.0.0",
		timestamp: new Date().toISOString(),
		authentication: {
			oauth_configured: oauthConfigured,
			tango_api_configured: tangoApiConfigured,
			mcp_token_system_enabled: mcpTokenSystemEnabled,
			require_authentication: requireAuth,
			hosted_domain: env.HOSTED_DOMAIN || null,
		},
	});

	return addSecurityHeaders(response);
});

export { app as GoogleHandler };
