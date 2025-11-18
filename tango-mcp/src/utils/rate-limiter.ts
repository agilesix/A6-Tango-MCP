/**
 * Rate Limiter for Tango API Requests
 *
 * Implements simple per-worker rate limiting with promise-based queue.
 * Ensures minimum 100ms delay between Tango API calls to comply with
 * conservative rate limits.
 *
 * Design:
 * - Per-worker timestamp tracking (not global across Workers)
 * - Promise chain for sequential request handling
 * - Simple implementation sufficient for MVP traffic levels
 *
 * Upgrade path: For production scale, consider Durable Objects for
 * distributed rate limiting across all Worker instances.
 */

/**
 * Rate limiter state
 * Tracks last API call timestamp and pending queue
 */
class RateLimiterState {
  /** Timestamp of last Tango API call */
  private lastCallTime = 0;

  /** Queue of pending requests */
  private requestQueue: Promise<void> = Promise.resolve();

  /**
   * Minimum delay between API calls in milliseconds
   * Conservative 100ms to avoid rate limit violations
   */
  private readonly minDelayMs: number;

  constructor(minDelayMs = 100) {
    this.minDelayMs = minDelayMs;
  }

  /**
   * Enforce rate limit by waiting if necessary
   *
   * Returns a promise that resolves after the required delay.
   * Chains requests to maintain ordering and prevent concurrent calls.
   *
   * @returns Promise that resolves when it's safe to make the next API call
   */
  async waitForSlot(): Promise<void> {
    // Chain this request to the end of the queue
    const myTurn = this.requestQueue.then(async () => {
      const now = Date.now();
      const timeSinceLastCall = now - this.lastCallTime;
      const waitTime = Math.max(0, this.minDelayMs - timeSinceLastCall);

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      // Update last call time
      this.lastCallTime = Date.now();
    });

    // Update queue to include this request
    this.requestQueue = myTurn;

    // Wait for our turn
    await myTurn;
  }

  /**
   * Get time until next available slot
   * Useful for diagnostics and testing
   *
   * @returns Milliseconds until next slot is available
   */
  getTimeUntilNextSlot(): number {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    return Math.max(0, this.minDelayMs - timeSinceLastCall);
  }

  /**
   * Reset rate limiter state
   * Useful for testing
   */
  reset(): void {
    this.lastCallTime = 0;
    this.requestQueue = Promise.resolve();
  }
}

/**
 * Global rate limiter instance
 * Per-worker singleton for tracking API call timing
 */
const globalRateLimiter = new RateLimiterState(100);

/**
 * Wait for rate limit slot before making API call
 *
 * Use this function before every Tango API request to ensure
 * rate limit compliance.
 *
 * @example
 * ```typescript
 * await enforceRateLimit();
 * const response = await fetch(tangoApiUrl, options);
 * ```
 */
export async function enforceRateLimit(): Promise<void> {
  await globalRateLimiter.waitForSlot();
}

/**
 * Get time until next API call is allowed
 * Useful for diagnostics and monitoring
 *
 * @returns Milliseconds until next slot is available
 */
export function getTimeUntilNextSlot(): number {
  return globalRateLimiter.getTimeUntilNextSlot();
}

/**
 * Reset rate limiter (for testing only)
 * Should not be used in production code
 */
export function resetRateLimiter(): void {
  globalRateLimiter.reset();
}

/**
 * Create a custom rate limiter with different delay
 * Useful for testing or if rate limits change
 *
 * @param minDelayMs Minimum delay between calls in milliseconds
 * @returns Rate limiter functions
 */
export function createRateLimiter(minDelayMs: number) {
  const limiter = new RateLimiterState(minDelayMs);

  return {
    enforceRateLimit: () => limiter.waitForSlot(),
    getTimeUntilNextSlot: () => limiter.getTimeUntilNextSlot(),
    reset: () => limiter.reset(),
  };
}
