import { z } from 'zod';
import { parseMobile } from '../user/phone.js';
import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH, PASSWORD_RULES } from './register.constants.js';

const name = (label: string): z.ZodString =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(NAME_MAX_LENGTH, `${label} must be at most ${NAME_MAX_LENGTH} characters`);

const password = z
  .string({ error: 'Password is required' })
  .min(PASSWORD_RULES.minLength, `Password must be at least ${PASSWORD_RULES.minLength} characters`)
  .max(PASSWORD_RULES.maxLength, `Password must be at most ${PASSWORD_RULES.maxLength} characters`)
  .regex(/[A-Z]/, 'Password needs an uppercase letter')
  .regex(/[a-z]/, 'Password needs a lowercase letter')
  .regex(/\d/, 'Password needs a digit')
  .regex(/[^A-Za-z0-9]/, 'Password needs a special character');

/** Body of the local register API. Output is normalised and ready for `UserService.create`. */
export const registerSchema = z
  .object({
    firstName: name('First name'),
    lastName: name('Last name'),
    email: z
      .string({ error: 'Email is required' })
      .trim()
      .toLowerCase()
      .max(EMAIL_MAX_LENGTH, 'Email is too long')
      .pipe(z.email('Invalid email address')),
    countryCode: z
      .string({ error: 'Country code is required' })
      .trim()
      .regex(/^\+?[1-9]\d{0,2}$/, 'Country code must look like +91'),
    mobile: z
      .string({ error: 'Mobile is required' })
      .trim()
      .regex(/^\d{4,14}$/, 'Mobile must be digits only, without the country code'),
    password,
  })
  .strict()
  .transform((value, ctx) => {
    const phone = parseMobile(value.countryCode, value.mobile);
    if (!phone) {
      ctx.addIssue({ code: 'custom', path: ['mobile'], message: 'Invalid mobile number' });
      return z.NEVER;
    }
    const { countryCode: _code, mobile: _mobile, ...rest } = value;
    return { ...rest, ...phone };
  });

export type RegisterInput = z.output<typeof registerSchema>;
