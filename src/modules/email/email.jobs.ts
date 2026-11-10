import { z } from 'zod';

const userRef = z.object({ userId: z.ulid({ error: 'userId must be a valid ULID' }) }).strict();

/**
 * Email queue jobs. Payloads hold ids only: the worker loads the user and, for
 * password reset, generates the token itself, so no secret ever sits in Redis job data.
 */
export const EMAIL_JOB_SCHEMAS = {
  welcome: userRef,
  'password-reset': userRef,
} as const;

export type EmailJobSchemas = typeof EMAIL_JOB_SCHEMAS;
export type EmailJobName = keyof EmailJobSchemas;
