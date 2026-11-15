import type { VaultRecord, VaultState } from './vault.types.js';

/** The operations available while one user's vault is locked for a push. */
export interface IVaultTransaction {
  find(id: string): Promise<VaultRecord | null>;
  /**
   * Inserts or replaces the entry and gives it the user's next change number.
   * Numbers only ever go up, in commit order.
   */
  save(state: VaultState): Promise<VaultRecord>;
}

/**
 * Persistence contract for vault entries. Implementations MUST make `runExclusive` serialize per
 * user (so two pushes can never interleave) and commit or roll back all its saves together.
 */
export interface IVaultRepository {
  /** Entries with a change number above `afterSeq`, oldest change first. */
  listAfter(userId: string, afterSeq: number, limit: number): Promise<VaultRecord[]>;
  runExclusive<T>(userId: string, work: (tx: IVaultTransaction) => Promise<T>): Promise<T>;
}
