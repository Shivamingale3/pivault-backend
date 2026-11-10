import { describe, it, expect } from 'vitest';
import { AppConfig } from '../../../src/core/config/AppConfig.js';

const VALID = {
  APP_PORT: '4000',
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://user:secret-password@localhost:5432/app',
  REDIS_CACHE_URL: 'redis://:cache-secret@localhost:6379/0',
  REDIS_QUEUE_URL: 'redis://:queue-secret@localhost:6380/0',
  REDIS_KEY_PREFIX: 'pivault',
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
