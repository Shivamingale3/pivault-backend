import type { Express } from 'express';
import { App } from './core/app/App.js';
import { HttpServer } from './core/app/HttpServer.js';
import { AppConfig } from './core/config/AppConfig.js';
import { RATE_LIMITS } from './core/constants/ratelimits.constants.js';
import { PrismaDatabase } from './core/database/PrismaDatabase.js';
import type { ILogger } from './core/logger/ILogger.js';
import { WinstonLogger } from './core/logger/WinstonLogger.js';
import { ErrorHandler } from './core/middlewares/ErrorHandler.js';
import { AppErrorMapper } from './core/middlewares/errorMappers/AppErrorMapper.js';
import { BodyParserErrorMapper } from './core/middlewares/errorMappers/BodyParserErrorMapper.js';
import { ZodErrorMapper } from './core/middlewares/errorMappers/ZodErrorMapper.js';
import { NotFoundHandler } from './core/middlewares/NotFoundHandler.js';
import { RateLimiterFactory } from './core/middlewares/RateLimiterFactory.js';
import { createHealthModule } from './modules/health/health.module.js';

export interface ContainerOverrides {
  config?: AppConfig;
  logger?: ILogger;
  database?: PrismaDatabase;
}

export interface Container {
  config: AppConfig;
  logger: ILogger;
  database: PrismaDatabase;
  app: Express;
  server: HttpServer;
}

/**
 * Composition root — the ONLY place that knows concrete classes.
 * Everything else depends on abstractions received via constructors.
 * Tests pass `overrides` to swap infrastructure (e.g. `NoopLogger`).
 */
export function createContainer(overrides: ContainerOverrides = {}): Container {
  const config = overrides.config ?? AppConfig.fromEnvironment();

  const logger =
    overrides.logger ??
    new WinstonLogger({
      level: config.isDevelopment ? 'debug' : 'info',
      format: config.isDevelopment ? 'pretty' : 'json',
    });

  const database = overrides.database ?? new PrismaDatabase(config.databaseUrl);

  const errorHandler = new ErrorHandler(logger, [
    new AppErrorMapper(),
    new ZodErrorMapper(),
    new BodyParserErrorMapper(),
  ]);

  // Feature modules — register new ones here.
  const modules = [createHealthModule()];

  const app = new App({
    logger,
    rateLimiterFactory: new RateLimiterFactory(logger, RATE_LIMITS),
    errorHandler,
    notFoundHandler: new NotFoundHandler(),
    modules,
  }).build();

  const server = new HttpServer(app, database, logger, config.port);

  return { config, logger, database, app, server };
}
