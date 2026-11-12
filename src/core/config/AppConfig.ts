import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import envSchema, { type AppEnvironment, type Env } from './env.schema.js';

/** backend/.env — resolves identically from src/core/config and dist/core/config. */
const DEFAULT_ENV_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../.env',
);

const IMPLICIT_TLS_PORT = 465;
/** Vite's dev server; only used when APP_URL is unset outside production. */
const DEFAULT_DEV_APP_URL = 'http://localhost:5173';

/** Outgoing-mail settings; `null` in AppConfig means "log emails instead of sending". */
export interface SmtpConfig {
  host: string;
  port: number;
  /** true = implicit TLS; false = mandatory STARTTLS. */
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

/**
 * Immutable, validated application configuration.
 *
 * The only place that reads `process.env`. Everything else receives an
 * `AppConfig` (or a narrower slice of it) through its constructor, so no
 * module depends on global environment state.
 */
export class AppConfig {
  readonly port: number;
  readonly environment: AppEnvironment;
  readonly databaseUrl: string;
  readonly redisCacheUrl: string;
  readonly redisQueueUrl: string;
  readonly redisKeyPrefix: string;
  /** Public PWA base URL (no trailing slash); links in emails are built from it. */
  readonly appUrl: string;
  readonly smtp: SmtpConfig | null;

  private constructor(values: Env) {
    this.port = values.APP_PORT;
    this.environment = values.APP_ENV;
    this.databaseUrl = values.DATABASE_URL;
    this.redisCacheUrl = values.REDIS_CACHE_URL;
    this.redisQueueUrl = values.REDIS_QUEUE_URL;
    this.redisKeyPrefix = values.REDIS_KEY_PREFIX;
    this.appUrl = (values.APP_URL ?? DEFAULT_DEV_APP_URL).replace(/\/+$/, '');
    this.smtp = AppConfig.smtpFrom(values);
    Object.freeze(this);
  }

  /** Loads `.env` into `process.env` (existing values win), then validates. */
  static fromEnvironment(envFile: string = DEFAULT_ENV_FILE): AppConfig {
    loadDotenv({ path: envFile, quiet: true });
    return AppConfig.fromValues(process.env);
  }

  /**
   * Validates an arbitrary key/value source. Throws with the failing keys and
   * reasons only — never the raw values, which may contain secrets.
   */
  static fromValues(source: Record<string, unknown>): AppConfig {
    const result = envSchema.safeParse(source);
    if (!result.success) {
      const details = result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new Error(`Invalid environment configuration — ${details}`);
    }
    return new AppConfig(result.data);
  }

  private static smtpFrom(values: Env): SmtpConfig | null {
    const {
      EMAIL_HOST: host,
      EMAIL_USER: user,
      EMAIL_PASSWORD: password,
      EMAIL_FROM: from,
    } = values;
    // The schema guarantees these four are set together.
    if (host === undefined || user === undefined || password === undefined || from === undefined) {
      return null;
    }
    const port = values.EMAIL_PORT;
    return { host, port, secure: port === IMPLICIT_TLS_PORT, user, password, from };
  }

  get isDevelopment(): boolean {
    return this.environment === 'development';
  }

  get isProduction(): boolean {
    return this.environment === 'production';
  }

  get isTest(): boolean {
    return this.environment === 'test';
  }
}
