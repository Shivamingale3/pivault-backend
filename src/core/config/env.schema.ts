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
});

export type Env = z.infer<typeof envSchema>;
export type AppEnvironment = Env['APP_ENV'];

export default envSchema;
