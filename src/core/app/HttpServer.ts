import type { Server } from 'node:http';
import type { Express } from 'express';
import type { ResourceGroup } from '../lifecycle/ResourceGroup.js';
import type { ILogger } from '../logger/ILogger.js';

/**
 * Owns the API process lifecycle: connect resources (the database), start
 * listening, and tear both down again. Signal handling lives in the entry
 * point so this class stays free of `process` side effects and is unit-testable.
 */
export class HttpServer {
  private server: Server | null = null;

  constructor(
    private readonly app: Express,
    private readonly resources: ResourceGroup,
    private readonly logger: ILogger,
    private readonly port: number,
  ) {}

  /** Resolves with the actual bound port (useful when `port` is 0). */
  async start(): Promise<number> {
    await this.resources.connectAll();

    try {
      this.server = await new Promise<Server>((resolve, reject) => {
        const instance = this.app.listen(this.port, (error?: Error) => {
          if (error) reject(error);
          else resolve(instance);
        });
      });
    } catch (error) {
      await this.resources.disconnectAll();
      throw error;
    }

    const address = this.server.address();
    const boundPort = typeof address === 'object' && address !== null ? address.port : this.port;
    this.logger.info(`Server is running on port ${boundPort}`);
    return boundPort;
  }

  /** Stops accepting connections, waits for in-flight ones, then disconnects resources. */
  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;

    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      this.logger.info('HTTP server closed.');
    }

    await this.resources.disconnectAll();
  }
}
