import type { JobsOptions } from 'bullmq';

const SECOND_MS = 1000;
const DAY_SECONDS = 24 * 60 * 60;

export const QueueName = {
  Email: 'email',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

/**
 * Retries with exponential backoff (5s, 10s, 20s, ...). Finished jobs are kept
 * briefly for debugging, then purged so Redis doesn't grow without bound.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5 * SECOND_MS },
  removeOnComplete: { age: DAY_SECONDS },
  removeOnFail: { age: 7 * DAY_SECONDS },
} as const satisfies JobsOptions;

/** Jobs processed in parallel per queue, sized for a Raspberry Pi. */
export const WORKER_CONCURRENCY: Record<QueueName, number> = {
  [QueueName.Email]: 2,
};
