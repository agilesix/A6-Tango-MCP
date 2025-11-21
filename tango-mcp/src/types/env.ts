/**
 * Cloudflare Workers Environment Bindings
 *
 * This interface defines the environment bindings available in Cloudflare Workers.
 * These bindings are configured in wrangler.jsonc and accessed via the env parameter
 * in request handlers.
 *
 * For Gateway Model authentication, the MCP server acts as a centralized gateway
 * using a single TANGO_API_KEY on behalf of authenticated users.
 */

/**
 * Environment bindings for Tango MCP Server (Gateway Model)
 */
export interface Env {
  // ==========================================
  // TANGO API CONFIGURATION
  // ==========================================

  /**
   * Tango API key for backend authentication
   *
   * CRITICAL: In Gateway Model, this is the centralized API key used for ALL
   * Tango API calls on behalf of authenticated users. This key is NEVER exposed
   * to clients - the MCP server acts as an authenticated gateway.
   *
   * SECURITY: This must be set as a Cloudflare Worker secret and is effectively
   * required in production (validation will enforce this).
   *
   * Set as a secret: wrangler secret put TANGO_API_KEY
   *
   * @required true (enforced by validation)
   * @secret true
   * @example "tango_api_key_abc123xyz"
   */
  TANGO_API_KEY?: string;

  /**
   * Base URL for Tango API
   *
   * @required false
   * @default "https://tango.makegov.com/api"
   * @example "https://tango.makegov.com/api"
   */
  TANGO_API_BASE_URL?: string;

  /**
   * Cache TTL in seconds
   *
   * How long to cache successful Tango API responses in KV.
   * Longer TTL reduces API calls but may serve stale data.
   *
   * @required false
   * @default "300" (5 minutes)
   * @example "300"
   */
  CACHE_TTL_SECONDS?: string;

  // ==========================================
  // KV NAMESPACES
  // ==========================================

  /**
   * KV namespace for caching Tango API responses
   *
   * Used for:
   * - Response caching with configurable TTL
   * - Reducing Tango API calls
   * - Improving response times
   *
   * Configured in wrangler.jsonc as [[kv_namespaces]]
   *
   * @required true
   * @binding kv_namespaces
   */
  TANGO_CACHE: KVNamespace;

  /**
   * KV namespace for OAuth state and MCP token storage
   *
   * Used for:
   * - OAuth state tokens (CSRF protection)
   * - Session binding (security)
   * - MCP access tokens (Agent SDK authentication)
   * - Approved client lists
   *
   * Configured in wrangler.jsonc as [[kv_namespaces]]
   *
   * @required true
   * @binding kv_namespaces
   */
  OAUTH_KV: KVNamespace;

  // ==========================================
  // GOOGLE OAUTH CONFIGURATION
  // ==========================================

  /**
   * Google OAuth Client ID
   *
   * Required for OAuth authentication flow (Claude Code/Web users).
   * Obtain from: https://console.cloud.google.com/apis/credentials
   *
   * @required true (for OAuth)
   * @example "123456789-abcdefg.apps.googleusercontent.com"
   */
  GOOGLE_CLIENT_ID?: string;

  /**
   * Google OAuth Client Secret
   *
   * Required for OAuth authentication flow.
   * SECURITY: Must be set as a Cloudflare Worker secret.
   *
   * Set as a secret: wrangler secret put GOOGLE_CLIENT_SECRET
   *
   * @required true (for OAuth)
   * @secret true
   * @example "GOCSPX-xxxxx"
   */
  GOOGLE_CLIENT_SECRET?: string;

  /**
   * Cookie encryption key for secure session management
   *
   * Used to sign and encrypt session cookies for OAuth flows.
   * SECURITY: Must be at least 32 characters. Generate with:
   * openssl rand -base64 32
   *
   * Set as a secret: wrangler secret put COOKIE_ENCRYPTION_KEY
   *
   * @required true (for OAuth)
   * @secret true
   * @minLength 32
   * @example "base64-encoded-32-byte-random-string"
   */
  COOKIE_ENCRYPTION_KEY?: string;

  /**
   * Hosted domain restriction for Google OAuth
   *
   * Restricts OAuth to specific Google Workspace domain (e.g., "agile6.com").
   * Leave empty to allow any Google account (not recommended for production).
   *
   * @required false
   * @recommended true (for production)
   * @example "agile6.com"
   */
  HOSTED_DOMAIN?: string;

  // ==========================================
  // MCP ACCESS TOKEN SYSTEM (GATEWAY MODEL)
  // ==========================================

  /**
   * Default expiration for MCP access tokens (days)
   *
   * MCP access tokens are long-lived tokens for Agent SDK authentication
   * since Agent SDK doesn't support OAuth. Tokens are stored in OAUTH_KV.
   *
   * WARNING: Setting this too high (>730 days) reduces security.
   *
   * @required false
   * @default "365"
   * @example "365"
   */
  MCP_TOKEN_EXPIRY_DAYS?: string;

  /**
   * Admin emails authorized to generate MCP access tokens
   *
   * Comma-separated list of email addresses (@agile6.com accounts).
   * Only these users can access the token generation admin interface.
   * Leave empty to disable admin token generation UI.
   *
   * @required false
   * @format "email1@example.com,email2@example.com"
   * @example "admin@agile6.com,manager@agile6.com"
   */
  ADMIN_EMAILS?: string;

  // ==========================================
  // AUTHENTICATION CONFIGURATION (GATEWAY MODEL)
  // ==========================================

  /**
   * Require authentication for all requests
   *
   * In Gateway Model, this should ALWAYS be "true" in production.
   * Set to "false" only for local development/testing.
   *
   * When true, all tool calls must be authenticated via OAuth or MCP token.
   * When false, unauthenticated requests will use env.TANGO_API_KEY directly.
   *
   * @required false
   * @default "true"
   * @example "true"
   */
  REQUIRE_AUTHENTICATION?: string;

  /**
   * Allowed authentication methods
   *
   * Comma-separated list of allowed auth methods: "oauth", "mcp-token"
   * Used to enable/disable specific authentication methods.
   *
   * @required false
   * @default "oauth,mcp-token"
   * @example "oauth,mcp-token"
   */
  ALLOWED_AUTH_METHODS?: string;

  /**
   * OAuth state token TTL (seconds)
   *
   * How long OAuth state tokens are valid before expiring.
   * Should be long enough to complete OAuth flow but not too long
   * to prevent replay attacks.
   *
   * @required false
   * @default "600" (10 minutes)
   * @example "600"
   */
  OAUTH_TOKEN_TTL_SECONDS?: string;

  /**
   * Session cookie max age (seconds)
   *
   * How long approved client cookies last.
   *
   * @required false
   * @default "2592000" (30 days)
   * @example "2592000"
   */
  SESSION_COOKIE_MAX_AGE?: string;

  // ==========================================
  // RATE LIMITING (OPTIONAL)
  // ==========================================

  /**
   * Rate limit per user/token (requests per hour)
   *
   * If set, enforce rate limits per authenticated user or token.
   * Leave empty to disable rate limiting.
   *
   * @required false
   * @example "1000"
   */
  RATE_LIMIT_PER_USER?: string;

  // ==========================================
  // MONITORING & OBSERVABILITY (OPTIONAL)
  // ==========================================

  /**
   * Enable detailed authentication logging
   *
   * When enabled, logs authentication attempts, successes, and failures.
   * Useful for debugging and security auditing.
   *
   * @required false
   * @default "false"
   * @example "true"
   */
  ENABLE_AUTH_LOGGING?: string;

  /**
   * Enable token usage analytics
   *
   * When enabled, tracks MCP token usage statistics.
   * Useful for understanding API usage patterns.
   *
   * @required false
   * @default "false"
   * @example "true"
   */
  ENABLE_TOKEN_ANALYTICS?: string;
}
