import cors from 'cors';
import express, { type Express, Router } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import type { IRouteModule } from '../http/IRouteModule.js';
import type { ILogger } from '../logger/ILogger.js';
import type { ErrorHandler } from '../middlewares/ErrorHandler.js';
import type { NotFoundHandler } from '../middlewares/NotFoundHandler.js';
import type { RateLimiterFactory } from '../middlewares/RateLimiterFactory.js';
import type { RateLimitKey } from '../constants/ratelimits.constants.js';

export interface AppDependencies {
  logger: ILogger;
  rateLimiterFactory: RateLimiterFactory<RateLimitKey>;
  errorHandler: ErrorHandler;
  notFoundHandler: NotFoundHandler;
  modules: readonly IRouteModule[];
  /** Browser origins allowed to read API responses cross-origin (the PWA's own origin). */
  allowedOrigins: readonly string[];
  /** Prefix every module is mounted under. Defaults to `/api`. */
  apiPrefix?: string;
}

/**
 * Facade that assembles the Express application from injected parts.
 * The middleware order here is deliberate — see inline comments.
 */
export class App {
  constructor(private readonly deps: AppDependencies) {}

  build(): Express {
    const app = express();
    const { logger, rateLimiterFactory, errorHandler, notFoundHandler } = this.deps;

    // nginx (the frontend container) fronts this backend and sets
    // X-Forwarded-* headers. Without `trust proxy`, express-rate-limit's
    // xForwardedForHeader validation crashes the route on every reverse-proxied
    // request. `1` trusts exactly one hop (the nginx container).
    app.set('trust proxy', 1);

    // Security headers + CORS before anything else touches the request.
    app.use(helmet());
    // Production is same-origin (nginx serves the PWA and proxies /api), so this only matters in
    // development. Any other origin gets no CORS headers and the browser blocks the read.
    app.use(cors({ origin: [...this.deps.allowedOrigins] }));

    // Reject floods before spending CPU on body parsing.
    app.use(rateLimiterFactory.create('GLOBAL'));

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const httpLogStream = {
      write: (line: string): void => {
        logger.info(line.trim());
      },
    };
    app.use(morgan('dev', { stream: httpLogStream }));

    app.use(this.deps.apiPrefix ?? '/api', this.buildApiRouter());

    // Must be last: 404 for unmatched routes, then the error handler.
    app.use(notFoundHandler.handle);
    app.use(errorHandler.handle);

    return app;
  }

  private buildApiRouter(): Router {
    const router = Router();
    for (const module of this.deps.modules) {
      router.use(module.basePath, module.getRouter());
    }
    return router;
  }
}
