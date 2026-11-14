import { z } from 'zod';
import { PASSWORD_RULES } from './password.constants.js';

/** The one account-password policy, shared by registration and password-link completion. */
export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(PASSWORD_RULES.minLength, `Password must be at least ${PASSWORD_RULES.minLength} characters`)
  .max(PASSWORD_RULES.maxLength, `Password must be at most ${PASSWORD_RULES.maxLength} characters`)
  .regex(/[A-Z]/, 'Password needs an uppercase letter')
  .regex(/[a-z]/, 'Password needs a lowercase letter')
  .regex(/\d/, 'Password needs a digit')
  .regex(/[^A-Za-z0-9]/, 'Password needs a special character');
