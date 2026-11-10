/** Cache key builders and TTLs. Keys are namespaced again by `RedisConnection` (`<prefix>:cache:`). */

const MINUTE_SECONDS = 60;

export const CACHE_TTL_SECONDS = {
  /** Upper bound for a cached session lookup; clamped to the session's own expiry. */
  SESSION: 15 * MINUTE_SECONDS,
  /** Forgot-password token lifetime (FEATURES.md: 15 minutes). */
  PASSWORD_RESET: 15 * MINUTE_SECONDS,
} as const;

export const CacheKeys = {
  session: (tokenHash: string) => `session:${tokenHash}`,
  passwordReset: (tokenHash: string) => `password-reset:${tokenHash}`,
} as const;
