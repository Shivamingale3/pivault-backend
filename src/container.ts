import type { Express } from 'express';
import { App } from './core/app/App.js';
import { HttpServer } from './core/app/HttpServer.js';
import type { ICache } from './core/cache/ICache.js';
import { RedisCache } from './core/cache/RedisCache.js';
import { RedisConnection } from './core/cache/RedisConnection.js';
import { AppConfig } from './core/config/AppConfig.js';
import { RATE_LIMITS } from './core/constants/ratelimits.constants.js';
import { Argon2PasswordHasher } from './core/crypto/Argon2PasswordHasher.js';
import { PrismaDatabase } from './core/database/PrismaDatabase.js';
import { ResourceGroup } from './core/lifecycle/ResourceGroup.js';
import type { ILogger } from './core/logger/ILogger.js';
import { WinstonLogger } from './core/logger/WinstonLogger.js';
import { ErrorHandler } from './core/middlewares/ErrorHandler.js';
import { AppErrorMapper } from './core/middlewares/errorMappers/AppErrorMapper.js';
import { BodyParserErrorMapper } from './core/middlewares/errorMappers/BodyParserErrorMapper.js';
import { ZodErrorMapper } from './core/middlewares/errorMappers/ZodErrorMapper.js';
import { PrismaErrorMapper } from './core/middlewares/errorMappers/PrismaErrorMapper.js';
import { LocalOnlyGuard } from './core/middlewares/LocalOnlyGuard.js';
import { NotFoundHandler } from './core/middlewares/NotFoundHandler.js';
import { RateLimiterFactory } from './core/middlewares/RateLimiterFactory.js';
import { RequestValidator } from './core/middlewares/RequestValidator.js';
import { BullMqJobQueue } from './core/queue/BullMqJobQueue.js';
import { QueueName } from './core/queue/queue.constants.js';
import type { IJobQueue } from './core/queue/queue.types.js';
import { createHealthModule } from './modules/health/health.module.js';
import { createRegisterModule } from './modules/register/register.module.js';
import { RegisterService } from './modules/register/RegisterService.js';
import { PrismaUserRepository } from './modules/user/PrismaUserRepository.js';
import { UserService } from './modules/user/UserService.js';
import { EMAIL_JOB_SCHEMAS, type EmailJobSchemas } from './modules/email/email.jobs.js';

export interface ContainerOverrides {
  config?: AppConfig;
  logger?: ILogger;
  database?: PrismaDatabase;
  redis?: RedisConnection;
}

export interface Container {
  config: AppConfig;
  logger: ILogger;
  database: PrismaDatabase;
  redis: RedisConnection;
  cache: ICache;
  emailQueue: IJobQueue<EmailJobSchemas>;
  resources: ResourceGroup;
  app: Express;
  server: HttpServer;
}

export function createLogger(config: AppConfig): ILogger {
  return new WinstonLogger({
    level: config.isDevelopment ? 'debug' : 'info',
    format: config.isDevelopment ? 'pretty' : 'json',
  });
}

/**
 * Composition root for the API process — the ONLY place that knows concrete classes.
 * Everything else depends on abstractions received via constructors.
 * Tests pass `overrides` to swap infrastructure (e.g. `NoopLogger`).
 */
export function createContainer(overrides: ContainerOverrides = {}): Container {
  const config = overrides.config ?? AppConfig.fromEnvironment();
  const logger = overrides.logger ?? createLogger(config);
  const database = overrides.database ?? new PrismaDatabase(config.databaseUrl);
  const redis =
    overrides.redis ??
    new RedisConnection({
      cacheUrl: config.redisCacheUrl,
      queueUrl: config.redisQueueUrl,
      keyPrefix: config.redisKeyPrefix,
    });
  const cache = new RedisCache(redis.cache, logger);

  // Producer only; the worker process (src/worker.ts) consumes.
  const emailQueue = new BullMqJobQueue({
    name: QueueName.Email,
    schemas: EMAIL_JOB_SCHEMAS,
    connection: redis.createBullConnection(),
    prefix: redis.queuePrefix,
  });

  // Connected in this order, disconnected in reverse.
  const resources = new ResourceGroup([database, redis, emailQueue], logger);

  const errorHandler = new ErrorHandler(logger, [
    new AppErrorMapper(),
    new PrismaErrorMapper(),
    new ZodErrorMapper(),
    new BodyParserErrorMapper(),
  ]);

  const rateLimiterFactory = new RateLimiterFactory(logger, RATE_LIMITS);

  // Feature modules — register new ones here.
  const userService = new UserService(new PrismaUserRepository(database.client));
  const registerService = new RegisterService(
    userService,
    new Argon2PasswordHasher(),
    emailQueue,
    logger,
  );
  const modules = [
    createHealthModule(() => resources.pingAll()),
    createRegisterModule(registerService, {
      localOnly: new LocalOnlyGuard(logger).handle,
      rateLimiter: rateLimiterFactory.create('REGISTER'),
      validator: new RequestValidator(),
    }),
  ];

  const app = new App({
    logger,
    rateLimiterFactory,
    errorHandler,
    notFoundHandler: new NotFoundHandler(),
    modules,
  }).build();

  const server = new HttpServer(app, resources, logger, config.port);

  return { config, logger, database, redis, cache, emailQueue, resources, app, server };
}
