import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Queue } from 'bullmq';
import { ulid } from 'ulid';
import { z } from 'zod';
import { BullMqJobQueue } from '../../src/core/queue/BullMqJobQueue.js';
import type { IJobProcessor } from '../../src/core/queue/queue.types.js';
import { WorkerHost } from '../../src/core/queue/WorkerHost.js';
import { createFakeLogger } from '../helpers/fakes.js';
import { createTestRedis, flushTestRedis } from '../helpers/redis.js';

const QUEUE = 'email';
const schemas = { welcome: z.object({ userId: z.ulid() }).strict() };

const redis = createTestRedis();
const producer = new BullMqJobQueue({
  name: QUEUE,
  schemas,
  connection: redis.createBullConnection(),
  prefix: redis.queuePrefix,
});
const inspector = new Queue(QUEUE, {
  connection: redis.createBullConnection(),
  prefix: redis.queuePrefix,
});

const handled: { name: string; payload: unknown }[] = [];
let onHandled: (() => void) | undefined;
const processor: IJobProcessor<typeof schemas> = {
  queueName: QUEUE,
  schemas,
  handle: vi.fn((name, payload) => {
    handled.push({ name, payload });
    onHandled?.();
    return Promise.resolve();
  }),
};
const logger = createFakeLogger();
const workers = new WorkerHost({
  createConnection: () => redis.createBullConnection(),
  prefix: redis.queuePrefix,
  logger,
}).register(processor);

const waitFor = async (check: () => Promise<boolean>, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for job');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

beforeAll(async () => {
  await redis.connect();
  await flushTestRedis(redis);
  await producer.connect();
  await workers.connect();
});
beforeEach(() => {
  handled.length = 0;
});
afterAll(async () => {
  await workers.disconnect();
  await producer.disconnect();
  await inspector.close();
  await redis.disconnect();
});

describe('BullMQ queue + WorkerHost', () => {
  it('delivers a validated job to its processor', async () => {
    const userId = ulid();
    const done = new Promise<void>((resolve) => (onHandled = resolve));
    const id = await producer.enqueue('welcome', { userId });
    await done;
    expect(handled).toEqual([{ name: 'welcome', payload: { userId } }]);
    await waitFor(async () => (await inspector.getJobState(id)) === 'completed');
  });

  it('rejects invalid payloads before they reach Redis', async () => {
    await expect(producer.enqueue('welcome', { userId: 'nope' })).rejects.toThrow();
    await expect(
      producer.enqueue('welcome', { userId: ulid(), token: 'secret' } as never),
    ).rejects.toThrow();
  });

  it('deduplicates by jobId', async () => {
    const userId = ulid();
    const first = await producer.enqueue('welcome', { userId }, { jobId: `welcome-${userId}` });
    const second = await producer.enqueue('welcome', { userId }, { jobId: `welcome-${userId}` });
    expect(second).toBe(first);
  });

  it('fails permanently (no retries) on payloads that bypass the producer', async () => {
    const job = await inspector.add('welcome', { userId: 'tampered' }, { attempts: 5 });
    const id = job.id ?? '';
    await waitFor(async () => (await inspector.getJobState(id)) === 'failed');
    const failed = await inspector.getJob(id);
    expect(failed?.attemptsMade).toBe(1);
    expect(handled.map((h) => h.payload)).not.toContainEqual({ userId: 'tampered' });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid payload'));
  });

  it('reports running workers via ping()', async () => {
    expect(await workers.ping()).toBe(true);
    expect(await producer.ping()).toBe(true);
  });
});
