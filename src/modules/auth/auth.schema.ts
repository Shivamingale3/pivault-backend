import { z } from 'zod';
import { EMAIL_MAX_LENGTH } from '../register/register.constants.js';
import { passwordSchema } from '../user/password.schema.js';
import { recoveryKeyCheckSchema } from '../user/recoveryKeyCheck.schema.js';
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

/**
 * The device may send its recovery-key check along. Older apps send no body at all, which is
 * read as "no check".
 */
export const recoveryKeyConfiguredSchema = z.preprocess(
  (value) => value ?? {},
  z.object({ keyCheck: recoveryKeyCheckSchema.optional() }).strict(),
);

/** A new recovery key's check, replacing the old one. */
export const replaceRecoveryKeyCheckSchema = z
  .object({ keyCheck: recoveryKeyCheckSchema })
  .strict();
export type ReplaceRecoveryKeyCheckInput = z.output<typeof replaceRecoveryKeyCheckSchema>;

export type RecoveryKeyConfiguredInput = z.output<typeof recoveryKeyConfiguredSchema>;
/** The current password is only bounded (a wrong one must look like any wrong one); the new one follows the policy. */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: 'Current password is required' })
      .min(1, 'Current password is required')
      .max(128),
    newPassword: passwordSchema,
  })
  .strict();

export type ChangePasswordInput = z.output<typeof changePasswordSchema>;
export type LoginInput = z.output<typeof loginSchema>;
export type ForgotPasswordInput = z.output<typeof forgotPasswordSchema>;
