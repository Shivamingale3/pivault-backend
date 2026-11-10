import { describe, it, expect } from 'vitest';
import envSchema from '../../../src/core/config/env.schema.js';

const PG_URL = 'postgresql://postgres:postgres@localhost:5432/app';
const REDIS_URL = 'redis://localhost:6379/0';

describe('envSchema', () => {
  it('parses valid env with all required vars', () => {
    const result = envSchema.parse({
      APP_PORT: '5000',
      APP_ENV: 'development',
      DATABASE_URL: PG_URL,
      REDIS_URL,
    });
    expect(result.APP_PORT).toBe(5000);
    expect(result.APP_ENV).toBe('development');
    expect(result.DATABASE_URL).toBe(PG_URL);
  });

  it('coerces string APP_PORT to number', () => {
    const result = envSchema.parse({
      APP_PORT: '3000',
      APP_ENV: 'test',
      DATABASE_URL: PG_URL,
      REDIS_URL,
    });
    expect(result.APP_PORT).toBe(3000);
    expect(typeof result.APP_PORT).toBe('number');
  });

  it('defaults APP_PORT to 5000 when unset', () => {
    const result = envSchema.parse({ APP_ENV: 'test', DATABASE_URL: PG_URL, REDIS_URL });
    expect(result.APP_PORT).toBe(5000);
  });

  it('accepts APP_PORT 0 (OS-assigned port, used by tests)', () => {
    const result = envSchema.parse({
      APP_PORT: '0',
      APP_ENV: 'test',
      DATABASE_URL: PG_URL,
      REDIS_URL,
    });
    expect(result.APP_PORT).toBe(0);
  });

  it('rejects out-of-range or non-integer APP_PORT', () => {
    for (const port of ['-1', '65536', '80.5', 'abc']) {
      const result = envSchema.safeParse({
        APP_PORT: port,
        APP_ENV: 'test',
        DATABASE_URL: PG_URL,
        REDIS_URL,
      });
      expect(result.success).toBe(false);
    }
  });

  it('accepts the postgres:// protocol alias', () => {
    const result = envSchema.safeParse({
      APP_ENV: 'test',
      DATABASE_URL: 'postgres://u:p@db:5432/app',
      REDIS_URL,
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown APP_ENV value', () => {
    const result = envSchema.safeParse({ APP_ENV: 'staging', DATABASE_URL: PG_URL, REDIS_URL });
    expect(result.success).toBe(false);
  });

  it('rejects missing DATABASE_URL', () => {
    const result = envSchema.safeParse({ APP_ENV: 'development' });
    expect(result.success).toBe(false);
  });

  it('rejects non-postgres DATABASE_URL', () => {
    for (const url of ['file:./dev.db', 'mysql://u:p@localhost/app', 'not-a-url']) {
      const result = envSchema.safeParse({ APP_ENV: 'development', DATABASE_URL: url, REDIS_URL });
      expect(result.success).toBe(false);
    }
  });

  it('defaults REDIS_KEY_PREFIX and accepts redis:// and rediss://', () => {
    for (const url of ['redis://localhost:6379/0', 'rediss://:secret@pi.local:6380']) {
      const result = envSchema.parse({ APP_ENV: 'test', DATABASE_URL: PG_URL, REDIS_URL: url });
      expect(result.REDIS_URL).toBe(url);
      expect(result.REDIS_KEY_PREFIX).toBe('pivault');
    }
  });

  it('rejects missing or non-redis REDIS_URL', () => {
    for (const url of [undefined, 'http://localhost:6379', 'not-a-url']) {
      const result = envSchema.safeParse({ APP_ENV: 'test', DATABASE_URL: PG_URL, REDIS_URL: url });
      expect(result.success).toBe(false);
    }
  });

  it('rejects an unsafe REDIS_KEY_PREFIX', () => {
    for (const prefix of ['', 'Has Spaces', 'a:b', 'x'.repeat(33)]) {
      const result = envSchema.safeParse({
        APP_ENV: 'test',
        DATABASE_URL: PG_URL,
        REDIS_URL,
        REDIS_KEY_PREFIX: prefix,
      });
      expect(result.success).toBe(false);
    }
  });
});
