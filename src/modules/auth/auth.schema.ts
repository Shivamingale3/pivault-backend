import { z } from 'zod';
import { EMAIL_MAX_LENGTH } from '../register/register.constants.js';
import { parseDevicePublicKey } from './devicePublicKey.js';

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX_LENGTH, 'Email is too long')
  .pipe(z.email('Invalid email address'));

/**
 * Login does not apply the password policy: a wrong guess must look like any other wrong guess.
 * The cap only stops absurdly long input from reaching argon2.
 */
export const loginSchema = z
  .object({
    email,
    password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(128),
    publicKey: z
      .string({ error: 'Device key is required' })
      .max(512)
      .refine((value) => parseDevicePublicKey(value) !== null, 'Device key is invalid'),
  })
  .strict();

export const forgotPasswordSchema = z.object({ email }).strict();

export type LoginInput = z.output<typeof loginSchema>;
export type ForgotPasswordInput = z.output<typeof forgotPasswordSchema>;
