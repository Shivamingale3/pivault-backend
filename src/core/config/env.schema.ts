import z from 'zod';

const redisUrl = (name: string): z.ZodURL =>
  z.url({
    protocol: /^rediss?$/,
    error: `${name} must be a valid redis:// or rediss:// connection string`,
  });

const envSchema = z.object({
  APP_PORT: z.coerce.number().int().min(0).max(65535).default(5000),
  APP_ENV: z
    .enum(['development', 'test', 'production'], {
      error: 'APP_ENV must be development, test or production',
    })
    .nonoptional(),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: 'DATABASE_URL must be a valid postgresql:// connection string',
  }),
  /** Redis instance for the cache (sessions, reset tokens). May be the same server as the queue. */
  REDIS_CACHE_URL: redisUrl('REDIS_CACHE_URL'),
  /** Redis instance for BullMQ job queues. */
  REDIS_QUEUE_URL: redisUrl('REDIS_QUEUE_URL'),
  /** Namespaces every cache and queue key, so several apps can share one Redis. */
  REDIS_KEY_PREFIX: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,32}$/, 'REDIS_KEY_PREFIX must be 1-32 chars of a-z, 0-9 or -')
    .default('pivault'),
});

export type Env = z.infer<typeof envSchema>;
export type AppEnvironment = Env['APP_ENV'];

export default envSchema;
