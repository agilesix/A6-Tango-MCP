/**
 * Cloudflare Workers Environment Bindings
 *
 * This interface defines the environment bindings available in Cloudflare Workers.
 * These bindings are configured in wrangler.toml and accessed via the env parameter
 * in request handlers.
 */

/**
 * Environment bindings for Tango MCP Server
 */
export interface Env {
  /**
   * Tango API key for authentication
   * Set as a Cloudflare Worker secret: wrangler secret put TANGO_API_KEY
   *
   * @example "your-api-key-here"
   */
  TANGO_API_KEY?: string;

  /**
   * KV namespace for caching Tango API responses
   * Configured in wrangler.toml as [[kv_namespaces]]
   *
   * Used for:
   * - Response caching with 5-minute TTL
   * - Reducing API calls
   * - Improving response times
   */
  TANGO_CACHE: KVNamespace;

  /**
   * Base URL for Tango API
   * Default: "https://tango.makegov.com/api"
   *
   * Can be overridden for testing or if API URL changes
   */
  TANGO_API_BASE_URL?: string;

  /**
   * Cache TTL in seconds
   * Default: 300 (5 minutes)
   *
   * How long to cache successful API responses in KV
   */
  CACHE_TTL_SECONDS?: string;

  /**
   * Google OAuth Client ID
   * Required for OAuth authentication flow
   *
   * Obtain from Google Cloud Console:
   * https://console.cloud.google.com/apis/credentials
   *
   * @example "123456789.apps.googleusercontent.com"
   */
  GOOGLE_CLIENT_ID?: string;

  /**
   * Google OAuth Client Secret
   * Required for OAuth authentication flow
   * Set as a Cloudflare Worker secret: wrangler secret put GOOGLE_CLIENT_SECRET
   *
   * Obtain from Google Cloud Console (keep this secret!)
   *
   * @example "GOCSPX-xxxxx"
   */
  GOOGLE_CLIENT_SECRET?: string;

  /**
   * KV namespace for OAuth state storage
   * Used for storing OAuth state tokens and session data
   * Configured in wrangler.toml as [[kv_namespaces]]
   */
  OAUTH_KV?: KVNamespace;

  /**
   * Cookie encryption key for secure session management
   * Set as a Cloudflare Worker secret: wrangler secret put COOKIE_ENCRYPTION_KEY
   *
   * Generate a random string for this value
   *
   * @example "random-encryption-key-here"
   */
  COOKIE_ENCRYPTION_KEY?: string;

  /**
   * Hosted domain for G Suite / Google Workspace organizations
   * Optional: Restricts OAuth to specific domain
   *
   * @example "example.com"
   */
  HOSTED_DOMAIN?: string;
}
