import { Prisma } from '@prisma/client';
import { describe, it, expect } from 'vitest';
import { uniqueViolationFields } from '../../../src/core/database/prismaErrors.js';

const p2002 = (meta: Record<string, unknown>, code = 'P2002') =>
  new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test', meta });

const adapter = (constraint: Record<string, unknown>, table = 'users') => ({
  driverAdapterError: { cause: { kind: 'UniqueConstraintViolation', constraint, table } },
});

describe('uniqueViolationFields', () => {
  it('reads the classic engine target (list or single string)', () => {
    expect(uniqueViolationFields(p2002({ target: ['email'] }))).toEqual(['email']);
    expect(uniqueViolationFields(p2002({ target: 'users_email_key' }))).toEqual([
      'users_email_key',
    ]);
  });

  it('reads adapter errors that list fields (Prisma <= 7.9)', () => {
    expect(uniqueViolationFields(p2002(adapter({ fields: ['countryCode', 'mobile'] })))).toEqual([
      'countryCode',
      'mobile',
    ]);
  });

  it.each([
    ['users_email_key', 'users', ['email']],
    ['users_countryCode_mobile_key', 'users', ['countryCode', 'mobile']],
    ['password_reset_tokens_tokenHash_key', 'password_reset_tokens', ['tokenHash']],
    ['sessions_userId_key', 'sessions', ['userId']],
  ])('derives columns from the index name (Prisma >= 7.10): %s', (index, table, expected) => {
    expect(uniqueViolationFields(p2002(adapter({ index }, table)))).toEqual(expected);
  });

  it('still finds columns when the table name is missing', () => {
    expect(uniqueViolationFields(p2002(adapter({ index: 'email_key' }, undefined)))).toEqual([
      'email',
    ]);
  });

  it('returns an empty list when the shape is unknown, and undefined for other errors', () => {
    expect(uniqueViolationFields(p2002({}))).toEqual([]);
    expect(uniqueViolationFields(p2002(adapter({})))).toEqual([]);
    expect(uniqueViolationFields(p2002({ target: ['email'] }, 'P2025'))).toBeUndefined();
    expect(uniqueViolationFields(new Error('nope'))).toBeUndefined();
  });
});
