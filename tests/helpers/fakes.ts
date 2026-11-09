import { vi } from 'vitest';
import type { IDatabase } from '../../src/core/database/IDatabase.js';
import type { ILogger } from '../../src/core/logger/ILogger.js';

/** ILogger whose methods are spies, for asserting what gets logged. */
export function createFakeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } satisfies ILogger;
}

/** In-memory IDatabase with spy lifecycle methods. */
export function createFakeDatabase(pingResult = true) {
  return {
    client: {},
    connect: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(() => Promise.resolve()),
    ping: vi.fn(() => Promise.resolve(pingResult)),
  } satisfies IDatabase;
}
