import { UnrecoverableError, Worker, type ConnectionOptions, type Job } from 'bullmq';
import type { IManagedResource } from '../lifecycle/IManagedResource.js';
import type { ILogger } from '../logger/ILogger.js';
import { WORKER_CONCURRENCY, type QueueName } from './queue.constants.js';
import type { IJobProcessor, JobSchemaMap } from './queue.types.js';

export interface WorkerHostOptions {
  /** Called once per queue; BullMQ workers need their own blocking connection. */
  createConnection: () => ConnectionOptions;
  prefix: string;
  logger: ILogger;
}

/**
 * Runs one BullMQ worker per registered processor. Unknown job names and
 * invalid payloads fail permanently (no retries); anything else is retried
 * with the queue's backoff.
 */
export class WorkerHost implements IManagedResource {
  readonly name = 'workers';
  private readonly processors: IJobProcessor<JobSchemaMap>[] = [];
  private workers: Worker[] = [];

  constructor(private readonly options: WorkerHostOptions) {}

  register<TMap extends JobSchemaMap>(processor: IJobProcessor<TMap>): this {
    this.processors.push(processor);
    return this;
  }

  connect(): Promise<void> {
    this.workers = this.processors.map((processor) => this.startWorker(processor));
    return Promise.all(this.workers.map((worker) => worker.waitUntilReady())).then(() => undefined);
  }

  async disconnect(): Promise<void> {
    const workers = this.workers.splice(0);
    await Promise.all(workers.map((worker) => worker.close()));
  }

  ping(): Promise<boolean> {
    return Promise.resolve(this.workers.length > 0 && this.workers.every((w) => w.isRunning()));
  }

  private startWorker(processor: IJobProcessor<JobSchemaMap>): Worker {
    const { logger } = this.options;
    const concurrency = WORKER_CONCURRENCY[processor.queueName as QueueName];
    const worker = new Worker(processor.queueName, (job) => this.run(processor, job), {
      connection: this.options.createConnection(),
      prefix: this.options.prefix,
      concurrency,
    });

    worker.on('failed', (job, error) => {
      logger.warn(
        `Job ${processor.queueName}/${job?.name ?? '?'} #${job?.id ?? '?'} failed ` +
          `(attempt ${job?.attemptsMade ?? 0}): ${error.message}`,
      );
    });
    worker.on('error', (error) => {
      logger.error(`Worker for queue "${processor.queueName}" errored.`, error);
    });
    return worker;
  }

  private async run(processor: IJobProcessor<JobSchemaMap>, job: Job): Promise<void> {
    const schema = processor.schemas[job.name];
    if (!schema) throw new UnrecoverableError(`Unknown job "${job.name}"`);
    const parsed = schema.safeParse(job.data);
    if (!parsed.success) throw new UnrecoverableError(`Invalid payload for "${job.name}"`);
    await processor.handle(job.name, parsed.data);
  }
}
