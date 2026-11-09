import { createContainer, type Container } from '../../src/container.js';
import { NoopLogger } from '../../src/core/logger/NoopLogger.js';

/**
 * Builds a fully-wired container for integration tests: real config
 * (pointed at TEST_DATABASE_URL by vitest.config.ts) and a silent logger.
 */
export function createTestContainer(): Container {
  return createContainer({ logger: new NoopLogger() });
}
