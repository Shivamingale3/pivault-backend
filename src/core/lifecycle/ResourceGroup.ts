import type { ILogger } from '../logger/ILogger.js';
import type { IManagedResource } from './IManagedResource.js';

/**
 * Connects resources in order and disconnects them in reverse, so dependents
 * (e.g. queue workers) shut down before what they depend on (Redis, database).
 */
export class ResourceGroup {
  private connected: IManagedResource[] = [];

  constructor(
    private readonly resources: readonly IManagedResource[],
    private readonly logger: ILogger,
  ) {}

  /** On failure, already-connected resources are disconnected before rethrowing. */
  async connectAll(): Promise<void> {
    for (const resource of this.resources) {
      try {
        await resource.connect();
        this.connected.push(resource);
        this.logger.info(`${resource.name} connected.`);
      } catch (error) {
        this.logger.error(`${resource.name} failed to connect.`, error);
        await this.disconnectAll();
        throw error;
      }
    }
  }

  /** Disconnects everything that connected, newest first. Never throws; logs failures. */
  async disconnectAll(): Promise<void> {
    const toClose = [...this.connected].reverse();
    this.connected = [];
    for (const resource of toClose) {
      try {
        await resource.disconnect();
        this.logger.info(`${resource.name} disconnected.`);
      } catch (error) {
        this.logger.error(`${resource.name} failed to disconnect cleanly.`, error);
      }
    }
  }

  /** `{ database: true, redis: false }`, for readiness endpoints. */
  async pingAll(): Promise<Record<string, boolean>> {
    const results = await Promise.all(
      this.resources.map(async (resource) => [resource.name, await resource.ping()] as const),
    );
    return Object.fromEntries(results);
  }
}
