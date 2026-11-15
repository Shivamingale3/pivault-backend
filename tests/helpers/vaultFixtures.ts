import { randomBytes } from 'node:crypto';
import { ulid } from 'ulid';
import type { DocumentDto } from '../../src/modules/vault/vault.schema.js';
import type { VaultState } from '../../src/modules/vault/vault.types.js';

/** A valid-looking encrypted entry. The bytes are random: the server can't tell and doesn't care. */
export function fakeState(overrides: Partial<VaultState> = {}): VaultState {
  return {
    id: ulid(),
    updatedAt: Date.now(),
    deleted: false,
    envelope: {
      version: 1,
      algorithm: 'AES-GCM-256',
      iv: randomBytes(12).toString('base64'),
      ciphertext: randomBytes(48).toString('base64'),
    },
    ...overrides,
  };
}

/** The same entry as the replication endpoints send it (`_deleted`). */
export const toDocument = ({ id, updatedAt, deleted, envelope }: VaultState): DocumentDto => ({
  id,
  updatedAt,
  _deleted: deleted,
  envelope: { ...envelope, version: 1, algorithm: 'AES-GCM-256' },
});

/** The next version of an entry: new content, later timestamp, same id. */
export const nextVersion = (state: VaultState, overrides: Partial<VaultState> = {}): VaultState =>
  fakeState({ id: state.id, updatedAt: state.updatedAt + 1, ...overrides });
