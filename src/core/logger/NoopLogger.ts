import type { ILogger } from './ILogger.js';

/** Null Object: satisfies `ILogger` while discarding everything (tests, CLI tools). */
export class NoopLogger implements ILogger {
  debug(): void {
    // intentionally empty
  }

  info(): void {
    // intentionally empty
  }

  warn(): void {
    // intentionally empty
  }

  error(): void {
    // intentionally empty
  }
}
