import { describe, it, expect } from 'vitest';
import { AppConfig } from '../../../src/core/config/AppConfig.js';

const VALID = {
  APP_PORT: '4000',
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://user:secret-password@localhost:5432/app',
  REDIS_CACHE_URL: 'redis://:cache-secret@localhost:6379/0',
  REDIS_QUEUE_URL: 'redis://:queue-secret@localhost:6380/0',
  REDIS_KEY_PREFIX: 'pivault',
  APP_URL: 'https://vault.example.com/',
  EMAIL_HOST: 'smtp.example.com',
  EMAIL_PORT: '587',
  EMAIL_USER: 'user',
  EMAIL_PASSWORD: 'secret',
  EMAIL_FROM: 'PiVault <no-reply@example.com>',
};

describe('AppConfig', () => {
  it('exposes typed, parsed values', () => {
    const config = AppConfig.fromValues(VALID);
    expect(config.port).toBe(4000);
    expect(config.environment).toBe('production');
    expect(config.databaseUrl).toBe(VALID.DATABASE_URL);
    expect(config.redisCacheUrl).toBe(VALID.REDIS_CACHE_URL);
    expect(config.redisQueueUrl).toBe(VALID.REDIS_QUEUE_URL);
    expect(config.redisKeyPrefix).toBe('pivault');
  });

  it.each([
    ['development', { isDevelopment: true, isProduction: false, isTest: false }],
    ['production', { isDevelopment: false, isProduction: true, isTest: false }],
    ['test', { isDevelopment: false, isProduction: false, isTest: true }],
  ])('derives environment flags for %s', (APP_ENV, flags) => {
    const config = AppConfig.fromValues({ ...VALID, APP_ENV });
    expect({
      isDevelopment: config.isDevelopment,
      isProduction: config.isProduction,
      isTest: config.isTest,
    }).toEqual(flags);
  });

  it('has no smtp settings unless EMAIL_* is configured', () => {
    const withoutEmail = Object.fromEntries(
      Object.entries(VALID).filter(([key]) => !key.startsWith('EMAIL_')),
    );
    expect(AppConfig.fromValues({ ...withoutEmail, APP_ENV: 'development' }).smtp).toBeNull();
  });

  it.each([
    ['587', false],
    ['465', true],
  ])('maps EMAIL_* to smtp settings (port %s → secure=%s)', (EMAIL_PORT, secure) => {
    const config = AppConfig.fromValues({ ...VALID, EMAIL_PORT });
    expect(config.smtp).toEqual({
      host: 'smtp.example.com',
      port: Number(EMAIL_PORT),
      secure,
      user: 'user',
      password: 'secret',
      from: 'PiVault <no-reply@example.com>',
    });
  });

  it('exposes the app URL without a trailing slash, with a dev fallback', () => {
    expect(AppConfig.fromValues(VALID).appUrl).toBe('https://vault.example.com');
    const { APP_URL: _unused, ...noUrl } = VALID;
    expect(AppConfig.fromValues({ ...noUrl, APP_ENV: 'development' }).appUrl).toBe(
      'http://localhost:5173',
    );
  });

  it('is immutable', () => {
    const config = AppConfig.fromValues(VALID);
    expect(Object.isFrozen(config)).toBe(true);
    expect(() => {
      (config as { port: number }).port = 1;
    }).toThrow(TypeError);
  });

  it('throws naming the failing keys', () => {
    expect(() => AppConfig.fromValues({ APP_ENV: 'staging' })).toThrow(/APP_ENV.*DATABASE_URL/s);
  });

  it('never leaks raw values (e.g. credentials) in the error message', () => {
    const leaky = {
      ...VALID,
      APP_PORT: 'not-a-port',
      DATABASE_URL: 'mysql://u:hunter2@h/db',
      REDIS_CACHE_URL: 'http://:hunter3@h',
      REDIS_QUEUE_URL: 'http://:hunter4@h',
    };
    expect(() => AppConfig.fromValues(leaky)).toThrow(
      expect.objectContaining({ message: expect.not.stringMatching(/hunter[234]/) }),
    );
  });

  it('fromEnvironment() reads process.env (set by vitest.config.ts)', () => {
    const config = AppConfig.fromEnvironment();
    expect(config.isTest).toBe(true);
    expect(config.databaseUrl).toBe(process.env['DATABASE_URL']);
  });
});
