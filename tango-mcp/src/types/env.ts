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
}
