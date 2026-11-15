import { describe, it, expect } from 'vitest';
import { forgotPasswordSchema, loginSchema } from '../../../../src/modules/auth/auth.schema.js';
import { createDevice } from '../../../helpers/deviceKey.js';

const { publicKey } = createDevice();

describe('loginSchema', () => {
  it('normalises the email and accepts a valid device key', () => {
    const parsed = loginSchema.parse({ email: '  Jane@Example.COM ', password: 'x', publicKey });
    expect(parsed.email).toBe('jane@example.com');
  });

  it('does not apply the password policy to login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'weak', publicKey }).success).toBe(
      true,
    );
  });

  it.each([
    ['missing password', { email: 'a@b.co', publicKey }],
    ['empty password', { email: 'a@b.co', password: '', publicKey }],
    ['huge password', { email: 'a@b.co', password: 'x'.repeat(129), publicKey }],
    ['bad email', { email: 'nope', password: 'x', publicKey }],
    ['missing key', { email: 'a@b.co', password: 'x' }],
    ['garbage key', { email: 'a@b.co', password: 'x', publicKey: 'AAAA' }],
    ['extra field', { email: 'a@b.co', password: 'x', publicKey, admin: true }],
  ])('rejects %s', (_name, body) => {
    expect(loginSchema.safeParse(body).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('takes only a normalised email', () => {
    expect(forgotPasswordSchema.parse({ email: 'A@B.co' })).toEqual({ email: 'a@b.co' });
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.co', x: 1 }).success).toBe(false);
  });
});
