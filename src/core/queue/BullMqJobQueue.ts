import { Queue, type ConnectionOptions } from 'bullmq';
import type { z } from 'zod';
import type { IManagedResource } from '../lifecycle/IManagedResource.js';
import { DEFAULT_JOB_OPTIONS } from './queue.constants.js';
import type { EnqueueOptions, IJobQueue, JobName, JobSchemaMap } from './queue.types.js';

export interface BullMqJobQueueOptions<TMap extends JobSchemaMap> {
  name: string;
  schemas: TMap;
  connection: ConnectionOptions;
  prefix: string;
}

/** BullMQ producer. Rejects invalid payloads before anything reaches Redis. */
export class BullMqJobQueue<TMap extends JobSchemaMap>
  implements IJobQueue<TMap>, IManagedResource
{
  readonly name: string;
  private readonly queue: Queue;
  private readonly schemas: TMap;

  constructor(options: BullMqJobQueueOptions<TMap>) {
    this.name = `queue:${options.name}`;
    this.schemas = options.schemas;
    this.queue = new Queue(options.name, {
      connection: options.connection,
      prefix: options.prefix,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }

  async enqueue<K extends JobName<TMap>>(
    name: K,
    payload: z.input<TMap[K]>,
    options: EnqueueOptions = {},
  ): Promise<string> {
    const schema = this.schemas[name];
    if (!schema) throw new Error(`Unknown job "${name}" for ${this.name}`);
    const data: unknown = schema.parse(payload);
    const job = await this.queue.add(name, data, {
      ...(options.jobId !== undefined && { jobId: options.jobId }),
      ...(options.delayMs !== undefined && { delay: options.delayMs }),
    });
    if (job.id === undefined) throw new Error(`${this.name} did not return a job id`);
    return job.id;
  }

  async connect(): Promise<void> {
    await this.queue.waitUntilReady();
  }

  async disconnect(): Promise<void> {
    await this.queue.close();
  }

  async ping(): Promise<boolean> {
    try {
      await this.queue.getJobCounts('waiting');
      return true;
    } catch {
      return false;
    }
  }
}
