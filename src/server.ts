import { createContainer, type Container } from './container.js';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

function registerShutdownHooks({ server, logger }: Container): void {
  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => {
      logger.info(`${signal} received, shutting down gracefully.`);
      server
        .stop()
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        });
    });
  }
}

async function main(): Promise<void> {
  // Building the container validates env; failures here happen before a
  // logger exists, so they are reported by the catch below via stderr.
  const container = createContainer();
  try {
    await container.server.start();
    registerShutdownHooks(container);
  } catch (error) {
    container.logger.error('Failed to connect to the database or start the server:', error);
    await container.database.disconnect().catch(() => undefined);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console -- logger may not exist yet (invalid env).
  console.error('Unexpected error during startup:', error);
  process.exit(1);
});
