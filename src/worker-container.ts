import { RedisCache } from './core/cache/RedisCache.js';
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
import { SmtpEmailSender } from './modules/email/SmtpEmailSender.js';
import { createSmtpTransport } from './modules/email/smtpTransport.js';
import { PasswordResetTokenService } from './modules/passwordReset/PasswordResetTokenService.js';
import { PrismaPasswordResetRepository } from './modules/passwordReset/PrismaPasswordResetRepository.js';
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

  // SMTP when configured (always in production); otherwise emails are only logged.
  const emailSender =
    overrides.emailSender ??
    (config.smtp
      ? new SmtpEmailSender(createSmtpTransport(config.smtp), config.smtp.from, logger)
      : new LogEmailSender(logger));

  const resetTokens = new PasswordResetTokenService(
    new PrismaPasswordResetRepository(database.client),
    new RedisCache(redis.cache, logger),
    logger,
  );

  const workers = new WorkerHost({
    createConnection: () => redis.createBullConnection(),
    prefix: redis.queuePrefix,
    logger,
  }).register(
    new EmailProcessor(
      new PrismaUserRepository(database.client),
      emailSender,
      resetTokens,
      config.appUrl,
    ),
  );

  // Workers stop first on shutdown, then Redis, then the database.
  const resources = new ResourceGroup([database, redis, workers], logger);

  return { config, logger, workers, resources };
}
