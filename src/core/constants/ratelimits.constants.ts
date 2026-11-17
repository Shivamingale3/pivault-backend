export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

const ONE_MINUTE_MS = 60 * 1000;

export const RATE_LIMIT_DEFAULT_MESSAGE = 'Too many requests, please try again later.';

/**
 * Named rate-limit profiles. Add a key here and call
 * `rateLimiterFactory.create(key)` to attach a route-specific limiter.
 */
export const RATE_LIMITS = {
  GLOBAL: {
    windowMs: ONE_MINUTE_MS,
    maxRequests: 60,
  },
  /** Local-only register endpoint: argon2 hashing is deliberately expensive. */
  REGISTER: {
    windowMs: ONE_MINUTE_MS,
    maxRequests: 5,
  },
  /** Public link check: cheap, but one page load = one call, so allow a few retries. */
  PASSWORD_LINK_VALIDATE: {
    windowMs: ONE_MINUTE_MS,
    maxRequests: 20,
  },
  /** Public link completion hashes with argon2, so it is kept tight like REGISTER. */
  PASSWORD_LINK_COMPLETE: {
    windowMs: ONE_MINUTE_MS,
    maxRequests: 5,
  },
  /** Public login: every attempt costs an argon2 verify, so it is kept tight. */
  LOGIN: {
    windowMs: ONE_MINUTE_MS,
    maxRequests: 10,
  },
  /** Signed change-password: one argon2 verify and one hash per call. */
  CHANGE_PASSWORD: {
    windowMs: ONE_MINUTE_MS,
    maxRequests: 5,
  },
  /** Public forgot-password: every call can send an email. */
  FORGOT_PASSWORD: {
    windowMs: ONE_MINUTE_MS,
    maxRequests: 3,
  },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitKey = keyof typeof RATE_LIMITS;
