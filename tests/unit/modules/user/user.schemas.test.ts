import { describe, it, expect } from 'vitest';
import { ulid } from 'ulid';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamsSchema,
} from '../../../../src/modules/user/user.schemas.js';

describe('createUserSchema', () => {
  it('trims and lowercases the email, trims the name', () => {
    expect(createUserSchema.parse({ email: '  Ann@Example.COM ', name: '  Ann ' })).toEqual({
      email: 'ann@example.com',
      name: 'Ann',
    });
  });

  it('allows omitting the name', () => {
    expect(createUserSchema.parse({ email: 'a@b.co' })).toEqual({ email: 'a@b.co' });
  });

  it('strips unknown keys such as a client-supplied id', () => {
    const parsed = createUserSchema.parse({ email: 'a@b.co', id: 'hijack', createdAt: 'x' });
    expect(parsed).toEqual({ email: 'a@b.co' });
  });

  it.each([
    [{}, 'email is required'],
    [{ email: 'not-an-email' }, 'email must be a valid email address'],
    [{ email: `${'a'.repeat(250)}@b.co` }, 'email must be at most 254 characters'],
    [{ email: 'a@b.co', name: '   ' }, 'name cannot be empty'],
    [{ email: 'a@b.co', name: 'x'.repeat(101) }, 'name must be at most 100 characters'],
    [{ email: 'a@b.co', name: 42 }, 'name must be a string'],
  ])('rejects %j with "%s"', (input, message) => {
    const result = createUserSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});

describe('updateUserSchema', () => {
  it('accepts a single field', () => {
    expect(updateUserSchema.parse({ name: 'B' })).toEqual({ name: 'B' });
    expect(updateUserSchema.parse({ email: 'B@X.io' })).toEqual({ email: 'b@x.io' });
  });

  it('accepts null to clear the name', () => {
    expect(updateUserSchema.parse({ name: null })).toEqual({ name: null });
  });

  it('rejects an empty body (or one with only unknown keys)', () => {
    for (const input of [{}, { foo: 'bar' }]) {
      const result = updateUserSchema.safeParse(input);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'At least one field (email, name) must be provided',
      );
    }
  });
});

describe('userIdParamsSchema', () => {
  it('accepts a ULID', () => {
    const id = ulid();
    expect(userIdParamsSchema.parse({ id })).toEqual({ id });
  });

  it.each(['123', 'not-a-ulid', '01ARZ3NDEKTSV4RRFFQ69G5FA'])('rejects %s', (id) => {
    const result = userIdParamsSchema.safeParse({ id });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('id must be a valid ULID');
  });
});

describe('listUsersQuerySchema', () => {
  it('applies pagination defaults', () => {
    expect(listUsersQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });
});
