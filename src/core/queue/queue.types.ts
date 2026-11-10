import type { z } from 'zod';

/** Job name → payload schema for one queue. Payloads carry ids only, never secrets. */
export type JobSchemaMap = Record<string, z.ZodType>;

export type JobName<TMap extends JobSchemaMap> = Extract<keyof TMap, string>;

export interface EnqueueOptions {
  /** Deduplicates: a second job with the same id is ignored while the first exists. */
  jobId?: string;
  delayMs?: number;
}

/** Producer side of a queue (used by the API). */
export interface IJobQueue<TMap extends JobSchemaMap> {
  /** Validates the payload, then enqueues it. Resolves with the job id. */
  enqueue<K extends JobName<TMap>>(
    name: K,
    payload: z.input<TMap[K]>,
    options?: EnqueueOptions,
  ): Promise<string>;
}

/** Consumer side of a queue (used by the worker process). */
export interface IJobProcessor<TMap extends JobSchemaMap> {
  readonly queueName: string;
  readonly schemas: TMap;
  handle<K extends JobName<TMap>>(name: K, payload: z.output<TMap[K]>): Promise<void>;
}
