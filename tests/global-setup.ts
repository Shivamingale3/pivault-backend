import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';
import { startTestRedis } from './redis-container.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

declare module 'vitest' {
  export interface ProvidedContext {
    redisUrl: string;
  }
}

/**
 * Starts the test Redis (Docker, unless TEST_REDIS_URL is set) and applies any
 * pending migrations to the Postgres test database, once per run.
 * DATABASE_URL is pointed at TEST_DATABASE_URL by vitest.config.ts.
 *
 * Deliberately non-destructive (`migrate deploy`, never `migrate reset`):
 * data isolation is handled per test via the truncate helpers in
 * tests/helpers/db.ts, so a misconfigured URL can never drop a real database.
 */
async function globalSetup(project: TestProject): Promise<() => void> {
  const external = process.env['TEST_REDIS_URL'];
  const redis = external ? { url: external, stop: () => undefined } : await startTestRedis();
  project.provide('redisUrl', redis.url);

  // cwd must be the backend/ dir so prisma finds prisma.config.ts.
  const backendDir = path.resolve(__dirname, '..');

  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: backendDir,
    env: process.env,
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    redis.stop();
    const stderr = result.stderr.toString();
    const stdout = result.stdout.toString();
    throw new Error(
      `prisma migrate deploy failed in global setup.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }

  return () => {
    // Integration tests truncate their own tables; only the Redis container needs removing.
    redis.stop();
  };
}

export default globalSetup;
