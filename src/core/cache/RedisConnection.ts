import { Redis } from 'ioredis';
import type { IManagedResource } from '../lifecycle/IManagedResource.js';

const PING_TIMEOUT_MS = 1000;

export interface RedisConnectionOptions {
  /** Redis instance backing the cache. */
  cacheUrl: string;
  /** Redis instance backing BullMQ; may be the same server as the cache. */
  queueUrl: string;
  /** App namespace, e.g. `pivault`. */
  keyPrefix: string;
}

/**
 * Owns every ioredis client the process opens, so one `disconnect()` closes them all.
 * - `cache`: fail-fast client for the cache (no offline queue, few retries).
 * - `createBullConnection()`: clients for BullMQ (against `queueUrl`), which requires
 *   `maxRetriesPerRequest: null`. The cache and queue may live on separate Redis servers.
 */
export class RedisConnection implements IManagedResource {
  readonly name = 'redis';
  readonly cache: Redis;
  /** BullMQ key prefix; cache keys live under `<prefix>:cache:`. */
  readonly queuePrefix: string;
  private readonly bullClients: Redis[] = [];

  constructor(private readonly options: RedisConnectionOptions) {
    this.queuePrefix = `${options.keyPrefix}:bull`;
    this.cache = new Redis(options.cacheUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 2,
      keyPrefix: `${options.keyPrefix}:cache:`,
    });
  }

  createBullConnection(): Redis {
    const client = new Redis(this.options.queueUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    this.bullClients.push(client);
    return client;
  }

  async connect(): Promise<void> {
    if (this.cache.status === 'wait' || this.cache.status === 'end') {
      await this.cache.connect();
    }
  }

  async disconnect(): Promise<void> {
    const clients = [this.cache, ...this.bullClients.splice(0)];
    await Promise.all(
      clients.map(async (client) => {
        if (client.status === 'end') return;
        try {
          await client.quit();
        } catch {
          client.disconnect();
        }
      }),
    );
  }

  async ping(): Promise<boolean> {
    try {
      await Promise.race([
        this.cache.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            reject(new Error('Redis ping timed out'));
          }, PING_TIMEOUT_MS).unref(),
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  }
}
