import { RedisConnection } from './core/cache/RedisConnection.js';
import { AppConfig } from './core/config/AppConfig.js';
import { PrismaDatabase } from './core/database/PrismaDatabase.js';
import { ResourceGroup } from './core/lifecycle/ResourceGroup.js';
import type { ILogger } from './core/logger/ILogger.js';
import { WorkerHost } from './core/queue/WorkerHost.js';
import { createLogger } from './container.js';
import { EmailProcessor } from './modules/email/EmailProcessor.js';
import type { IEmailSender } from './modules/email/IEmailSender.js';
import { LogEmailSender } from './modules/email/LogEmailSender.js';
import { PrismaUserRepository } from './modules/user/PrismaUserRepository.js';

export interface WorkerContainerOverrides {
  config?: AppConfig;
  logger?: ILogger;
  emailSender?: IEmailSender;
}

export interface WorkerContainer {
  config: AppConfig;
  logger: ILogger;
  workers: WorkerHost;
  resources: ResourceGroup;
}

/** Composition root for the queue worker process (`npm run dev:worker`). */
export function createWorkerContainer(overrides: WorkerContainerOverrides = {}): WorkerContainer {
  const config = overrides.config ?? AppConfig.fromEnvironment();
  const logger = overrides.logger ?? createLogger(config);
  const database = new PrismaDatabase(config.databaseUrl);
  const redis = new RedisConnection({
    cacheUrl: config.redisCacheUrl,
    queueUrl: config.redisQueueUrl,
    keyPrefix: config.redisKeyPrefix,
  });

  // Real SMTP delivery arrives with the register step.
  const emailSender = overrides.emailSender ?? new LogEmailSender(logger);

  const workers = new WorkerHost({
    createConnection: () => redis.createBullConnection(),
    prefix: redis.queuePrefix,
    logger,
  }).register(new EmailProcessor(new PrismaUserRepository(database.client), emailSender));

  // Workers stop first on shutdown, then Redis, then the database.
  const resources = new ResourceGroup([database, redis, workers], logger);

  return { config, logger, workers, resources };
}
