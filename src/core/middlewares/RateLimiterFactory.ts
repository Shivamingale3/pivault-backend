import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import {
  RATE_LIMIT_DEFAULT_MESSAGE,
  type RateLimitConfig,
} from '../constants/ratelimits.constants.js';
import type { ILogger } from '../logger/ILogger.js';

/**
 * Factory for named rate limiters. `TKey` is inferred from the profile map
 * passed in, so `create()` only accepts keys that actually exist.
 */
export class RateLimiterFactory<TKey extends string> {
  constructor(
    private readonly logger: ILogger,
    private readonly profiles: Readonly<Record<TKey, RateLimitConfig>>,
  ) {}

  create(key: TKey): RateLimitRequestHandler {
    const config = this.profiles[key];
    const message = config.message ?? RATE_LIMIT_DEFAULT_MESSAGE;
    const retryAfterSeconds = Math.ceil(config.windowMs / 1000);

    return rateLimit({
      windowMs: config.windowMs,
      limit: config.maxRequests,
      standardHeaders: false,
      legacyHeaders: false,
      handler: (req, res, _next, options) => {
        res.setHeader('RateLimit-Limit', config.maxRequests);
        res.setHeader('RateLimit-Remaining', 0);
        res.setHeader('RateLimit-Reset', retryAfterSeconds);
        res.setHeader('Retry-After', retryAfterSeconds);

        this.logger.warn(
          `Rate limit [${key}] hit by ${req.ip ?? 'unknown'} on ${req.method} ${req.originalUrl}`,
        );

        res.status(options.statusCode).json({ success: false, message });
      },
    });
  }
}
