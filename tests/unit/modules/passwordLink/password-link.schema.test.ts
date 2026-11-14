import { describe, it, expect } from 'vitest';
import { INVALID_LINK_MESSAGE } from '../../../../src/modules/passwordLink/passwordLink.constants.js';
import {
  completeLinkSchema,
  validateLinkSchema,
} from '../../../../src/modules/passwordLink/passwordLink.schema.js';

const token = 'A'.repeat(43);

describe('password link schemas', () => {
  it('accepts a well-formed token', () => {
    expect(validateLinkSchema.safeParse({ token }).success).toBe(true);
    expect(completeLinkSchema.safeParse({ token, password: 'Passw0rd!' }).success).toBe(true);
  });

  it.each([
    ['too short', 'abc'],
    ['too long', 'A'.repeat(44)],
    ['bad characters', `${'A'.repeat(42)}!`],
    ['not a string', 42],
  ])('gives the generic message for a token that is %s', (_name, value) => {
    const result = validateLinkSchema.safeParse({ token: value });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(INVALID_LINK_MESSAGE);
  });

  it('applies the shared password rules', () => {
    const result = completeLinkSchema.safeParse({ token, password: 'weakpass' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(validateLinkSchema.safeParse({ token, extra: 1 }).success).toBe(false);
  });
});
