import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend/.env first so TEST_DATABASE_URL is available below.
config({ path: path.resolve(__dirname, '.env'), quiet: true });

// Force the test environment BEFORE any test builds an AppConfig. These are
// assigned (not `??=`) because .env was just loaded and would otherwise win.
// DATABASE_URL always points at the test DB — never the dev/prod one — since
// integration tests truncate tables.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/app_test';
process.env.APP_ENV = 'test';
process.env.APP_PORT = '0';
// Isolates test keys; REDIS_URL itself is provided by tests/global-setup.ts.
process.env.REDIS_KEY_PREFIX = 'pivault-test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/setup-env.ts'],
    // Run test files sequentially so integration tests sharing the single
    // Postgres test database don't truncate each other's rows mid-test.
    fileParallelism: false,
    isolate: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
    },
  },
});
