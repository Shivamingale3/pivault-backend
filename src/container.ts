import type { Express } from 'express';
import { App } from './core/app/App.js';
import { HttpServer } from './core/app/HttpServer.js';
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
import type { IEmailSender } from './modules/email/IEmailSender.js';
import { LogEmailSender } from './modules/email/LogEmailSender.js';
import { SmtpEmailSender } from './modules/email/SmtpEmailSender.js';
import { createSmtpTransport } from './modules/email/smtpTransport.js';
import { WelcomeEmailService } from './modules/email/WelcomeEmailService.js';
import { PasswordResetTokenService } from './modules/passwordReset/PasswordResetTokenService.js';
import { PrismaPasswordResetRepository } from './modules/passwordReset/PrismaPasswordResetRepository.js';
import { createHealthModule } from './modules/health/health.module.js';
import { createRegisterModule } from './modules/register/register.module.js';
import { RegisterService } from './modules/register/RegisterService.js';
import { PrismaUserRepository } from './modules/user/PrismaUserRepository.js';
import { UserService } from './modules/user/UserService.js';

export interface ContainerOverrides {
  config?: AppConfig;
  logger?: ILogger;
  database?: PrismaDatabase;
  emailSender?: IEmailSender;
}

export interface Container {
  config: AppConfig;
  logger: ILogger;
  database: PrismaDatabase;
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
  // SMTP when configured (always in production); otherwise emails are only logged.
  const emailSender =
    overrides.emailSender ??
    (config.smtp
      ? new SmtpEmailSender(createSmtpTransport(config.smtp), config.smtp.from, logger)
      : new LogEmailSender(logger));

  const resources = new ResourceGroup([database], logger);

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
    new WelcomeEmailService(
      emailSender,
      new PasswordResetTokenService(new PrismaPasswordResetRepository(database.client)),
      config.appUrl,
    ),
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

  return { config, logger, database, resources, app, server };
}
