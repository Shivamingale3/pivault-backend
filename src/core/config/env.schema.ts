import z from 'zod';

const envObject = z.object({
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
  /** Public base URL of the PWA; emailed links (e.g. /reset-password) point here. Required in production. */
  APP_URL: z.url({ protocol: /^https?$/, error: 'APP_URL must be an http(s) URL' }).optional(),
  /** SMTP relay for outgoing email. Unset in dev/test → emails are only logged. */
  EMAIL_HOST: z.string().trim().min(1).optional(),
  /** 465 = implicit TLS; anything else (e.g. 587) = mandatory STARTTLS. Never plaintext. */
  EMAIL_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  EMAIL_USER: z.string().trim().min(1).optional(),
  EMAIL_PASSWORD: z.string().min(1).optional(),
  /** Sender shown to recipients, e.g. `PiVault <no-reply@example.com>`. */
  EMAIL_FROM: z.string().trim().min(1).optional(),
});

const EMAIL_REQUIRED = ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM'] as const;

/**
 * Production needs APP_URL. Email is all-or-nothing: setting any EMAIL_* value requires the whole set, and production
 * must have it (a vault that cannot send reset emails is broken).
 */
const envSchema = envObject.superRefine((env, ctx) => {
  if (env.APP_ENV === 'production' && env.APP_URL === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['APP_URL'],
      message: 'APP_URL is required in production',
    });
  }
  const configured = EMAIL_REQUIRED.some((key) => env[key] !== undefined);
  if (!configured && env.APP_ENV !== 'production') return;
  for (const key of EMAIL_REQUIRED) {
    if (env[key] === undefined) {
      ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required to send email` });
    }
  }
});

export type Env = z.infer<typeof envSchema>;
export type AppEnvironment = Env['APP_ENV'];

export default envSchema;
