import { z } from 'zod';
import { parseMobile } from '../user/phone.js';
import { passwordSchema } from '../user/password.schema.js';
import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH } from './register.constants.js';

const name = (label: string): z.ZodString =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(NAME_MAX_LENGTH, `${label} must be at most ${NAME_MAX_LENGTH} characters`);

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
    password: passwordSchema,
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
