import { describe, it, expect } from 'vitest';
import { registerSchema } from '../../../../src/modules/register/register.schema.js';

const VALID = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  countryCode: '+91',
  mobile: '9876543210',
  password: 'Passw0rd!',
};

const firstIssue = (input: unknown): string | undefined =>
  registerSchema.safeParse(input).error?.issues[0]?.message;

describe('registerSchema', () => {
  it('normalises into user data with the mobile split in two', () => {
    const result = registerSchema.parse({
      ...VALID,
      firstName: '  Jane ',
      email: '  Jane@Example.COM ',
    });
    expect(result).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      countryCode: '91',
      mobile: '9876543210',
      password: 'Passw0rd!',
    });
  });

  it('accepts the country code with or without "+"', () => {
    expect(registerSchema.parse({ ...VALID, countryCode: '91' }).countryCode).toBe('91');
  });

  it.each([
    ['firstName', '', 'First name is required'],
    ['lastName', ' ', 'Last name is required'],
    ['email', 'not-an-email', 'Invalid email address'],
    ['countryCode', '+0', 'Country code must look like +91'],
    ['mobile', '98 7654', 'Mobile must be digits only, without the country code'],
    ['mobile', '1234567', 'Invalid mobile number'],
  ])('rejects bad %s (%s)', (field, value, message) => {
    expect(firstIssue({ ...VALID, [field]: value })).toBe(message);
  });

  it.each([
    ['Sh0rt!', 'Password must be at least 8 characters'],
    ['Passw0rd!Passw0rd!X', 'Password must be at most 16 characters'],
    ['passw0rd!', 'Password needs an uppercase letter'],
    ['PASSW0RD!', 'Password needs a lowercase letter'],
    ['Password!', 'Password needs a digit'],
    ['Passw0rdd', 'Password needs a special character'],
  ])('rejects password %s', (password, message) => {
    expect(firstIssue({ ...VALID, password })).toBe(message);
  });

  it('rejects unknown keys so nothing unexpected reaches the database', () => {
    expect(registerSchema.safeParse({ ...VALID, id: 'x' }).success).toBe(false);
  });
});
