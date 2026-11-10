import { describe, it, expect } from 'vitest';
import { Argon2PasswordHasher } from '../../../../src/core/crypto/Argon2PasswordHasher.js';

const hasher = new Argon2PasswordHasher();

describe('Argon2PasswordHasher', () => {
  it('hashes with argon2id and verifies the right password', async () => {
    const hash = await hasher.hash('Passw0rd!');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('Passw0rd!');
    expect(await hasher.verify(hash, 'Passw0rd!')).toBe(true);
  });

  it('salts every hash', async () => {
    expect(await hasher.hash('Passw0rd!')).not.toBe(await hasher.hash('Passw0rd!'));
  });

  it('rejects a wrong password and a malformed hash without throwing', async () => {
    const hash = await hasher.hash('Passw0rd!');
    expect(await hasher.verify(hash, 'wrong')).toBe(false);
    expect(await hasher.verify('not-a-hash', 'Passw0rd!')).toBe(false);
  });
});
