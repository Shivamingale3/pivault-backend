import { describe, expect, it } from 'vitest';
import { pullSchema, pushSchema } from '../../../../src/modules/vault/vault.schema.js';
import { fakeState, toDocument } from '../../../helpers/vaultFixtures.js';

const doc = () => toDocument(fakeState());
const row = (overrides = {}) => ({
  assumedMasterState: null,
  newDocumentState: doc(),
  ...overrides,
});

describe('pullSchema', () => {
  it('takes a checkpoint (or none) and defaults the limit', () => {
    expect(pullSchema.parse({ checkpoint: null })).toEqual({ checkpoint: null, limit: 50 });
    expect(pullSchema.parse({ checkpoint: { seq: 7 }, limit: 20 })).toEqual({
      checkpoint: { seq: 7 },
      limit: 20,
    });
  });

  it.each([
    ['no checkpoint field', {}],
    ['negative seq', { checkpoint: { seq: -1 } }],
    ['fractional seq', { checkpoint: { seq: 1.5 } }],
    ['limit too high', { checkpoint: null, limit: 101 }],
    ['limit zero', { checkpoint: null, limit: 0 }],
    ['unknown field', { checkpoint: null, userId: 'someone-else' }],
  ])('rejects %s', (_name, body) => {
    expect(pullSchema.safeParse(body).success).toBe(false);
  });
});

describe('pushSchema', () => {
  it('accepts valid rows', () => {
    expect(
      pushSchema.safeParse({ rows: [row(), row({ assumedMasterState: doc() })] }).success,
    ).toBe(true);
  });

  it.each([
    ['no rows', { rows: [] }],
    ['too many rows', { rows: Array.from({ length: 11 }, () => row()) }],
    ['extra field on a row', { rows: [{ ...row(), userId: 'x' }] }],
    ['a bad entry id', { rows: [row({ newDocumentState: { ...doc(), id: 'short' } })] }],
    [
      'a lowercase entry id',
      { rows: [row({ newDocumentState: { ...doc(), id: 'a'.repeat(26) } })] },
    ],
    ['a fractional timestamp', { rows: [row({ newDocumentState: { ...doc(), updatedAt: 1.5 } })] }],
    [
      'a missing _deleted',
      { rows: [row({ newDocumentState: { ...doc(), _deleted: undefined } })] },
    ],
  ])('rejects %s', (_name, body) => {
    expect(pushSchema.safeParse(body).success).toBe(false);
  });

  it('only accepts the one envelope format the app writes', () => {
    const withEnvelope = (envelope: object) =>
      pushSchema.safeParse({
        rows: [
          row({ newDocumentState: { ...doc(), envelope: { ...doc().envelope, ...envelope } } }),
        ],
      }).success;
    expect(withEnvelope({})).toBe(true);
    expect(withEnvelope({ version: 2 })).toBe(false);
    expect(withEnvelope({ algorithm: 'AES-CBC' })).toBe(false);
    expect(withEnvelope({ iv: 'AAAA' })).toBe(false);
    expect(withEnvelope({ iv: '!'.repeat(16) })).toBe(false);
    expect(withEnvelope({ ciphertext: 'not base64 !!' })).toBe(false);
    expect(withEnvelope({ ciphertext: 'AAAA' })).toBe(false);
    expect(withEnvelope({ ciphertext: 'A'.repeat(90_001) })).toBe(false);
    expect(withEnvelope({ plaintext: 'oops' })).toBe(false);
  });
});
