import z from 'zod';

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
  REDIS_URL: z.url({
    protocol: /^rediss?$/,
    error: 'REDIS_URL must be a valid redis:// or rediss:// connection string',
  }),
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
