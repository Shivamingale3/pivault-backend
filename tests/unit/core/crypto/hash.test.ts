import { describe, it, expect } from 'vitest';
import { safeEqual, sha256Hex } from '../../../../src/core/crypto/hash.js';

describe('hash helpers', () => {
  it('sha256Hex matches the known digest and is 64 hex chars', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('safeEqual compares without throwing on length mismatch', () => {
    expect(safeEqual('same', 'same')).toBe(true);
    expect(safeEqual('same', 'diff')).toBe(false);
    expect(safeEqual('short', 'longer-value')).toBe(false);
  });
});
