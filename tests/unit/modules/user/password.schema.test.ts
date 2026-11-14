import { describe, it, expect } from 'vitest';
import { passwordSchema } from '../../../../src/modules/user/password.schema.js';

describe('passwordSchema', () => {
  it('accepts a password meeting every rule', () => {
    expect(passwordSchema.safeParse('Passw0rd!').success).toBe(true);
  });

  it.each([
    ['too short', 'Pw0!abc'],
    ['too long', 'Passw0rd!Passw0rd!'],
    ['no uppercase', 'passw0rd!'],
    ['no lowercase', 'PASSW0RD!'],
    ['no digit', 'Password!'],
    ['no special character', 'Passw0rdd'],
  ])('rejects a password that is %s', (_name, value) => {
    expect(passwordSchema.safeParse(value).success).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(passwordSchema.safeParse(undefined).success).toBe(false);
  });
});
