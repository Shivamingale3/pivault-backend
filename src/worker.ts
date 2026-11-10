import { createWorkerContainer, type WorkerContainer } from './worker-container.js';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

function registerShutdownHooks({ resources, logger }: WorkerContainer): void {
  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => {
      logger.info(`${signal} received, draining workers.`);
      resources
        .disconnectAll()
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          logger.error('Error during worker shutdown:', error);
          process.exit(1);
        });
    });
  }
}

async function main(): Promise<void> {
  const container = createWorkerContainer();
  try {
    await container.resources.connectAll();
    registerShutdownHooks(container);
    container.logger.info('Queue workers are running.');
  } catch (error) {
    container.logger.error('Worker failed to start:', error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console -- logger may not exist yet (invalid env).
  console.error('Unexpected error during worker startup:', error);
  process.exit(1);
});
