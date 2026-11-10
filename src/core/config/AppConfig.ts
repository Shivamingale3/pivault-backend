import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import envSchema, { type AppEnvironment, type Env } from './env.schema.js';

/** backend/.env — resolves identically from src/core/config and dist/core/config. */
const DEFAULT_ENV_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../.env',
);

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
  readonly redisUrl: string;
  readonly redisKeyPrefix: string;

  private constructor(values: Env) {
    this.port = values.APP_PORT;
    this.environment = values.APP_ENV;
    this.databaseUrl = values.DATABASE_URL;
    this.redisUrl = values.REDIS_URL;
    this.redisKeyPrefix = values.REDIS_KEY_PREFIX;
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
