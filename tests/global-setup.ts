import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Applies any pending migrations to the Postgres test database once per run.
 * DATABASE_URL is pointed at TEST_DATABASE_URL by vitest.config.ts.
 *
 * Deliberately non-destructive (`migrate deploy`, never `migrate reset`):
 * data isolation is handled per test via the truncate helpers in
 * tests/helpers/db.ts, so a misconfigured URL can never drop a real database.
 */
async function globalSetup(): Promise<() => void> {
  // cwd must be the backend/ dir so prisma finds prisma.config.ts.
  const backendDir = path.resolve(__dirname, '..');

  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: backendDir,
    env: process.env,
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    const stderr = result.stderr.toString();
    const stdout = result.stdout.toString();
    throw new Error(
      `prisma migrate deploy failed in global setup.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }

  return () => {
    // Teardown: nothing — integration tests truncate their own tables.
  };
}

export default globalSetup;
