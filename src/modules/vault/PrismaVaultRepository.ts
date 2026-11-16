import type { PrismaClient, VaultEntry } from '@prisma/client';
import type { IVaultRepository, IVaultTransaction } from './IVaultRepository.js';
import type { VaultRecord, VaultState } from './vault.types.js';

const toRecord = (row: VaultEntry): VaultRecord => ({
  id: row.id,
  seq: Number(row.seq),
  updatedAt: Number(row.updatedAt),
  deleted: row.deleted,
  envelope: {
    version: row.envelopeVersion,
    algorithm: row.algorithm,
    iv: row.iv,
    ciphertext: row.ciphertext,
  },
});

export class PrismaVaultRepository implements IVaultRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listAfter(userId: string, afterSeq: number, limit: number): Promise<VaultRecord[]> {
    const rows = await this.prisma.vaultEntry.findMany({
      where: { userId, seq: { gt: BigInt(afterSeq) } },
      orderBy: { seq: 'asc' },
      take: limit,
    });
    return rows.map(toRecord);
  }

  countAfter(userId: string, afterSeq: number): Promise<number> {
    return this.prisma.vaultEntry.count({ where: { userId, seq: { gt: BigInt(afterSeq) } } });
  }

  /**
   * Locks the user's row for the whole transaction, so concurrent pushes queue up. Each save takes
   * the next `vaultSeq`: numbers are therefore handed out, and committed, in the same order.
   */
  runExclusive<T>(userId: string, work: (tx: IVaultTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
      const transaction: IVaultTransaction = {
        find: async (id) => {
          const row = await tx.vaultEntry.findUnique({ where: { userId_id: { userId, id } } });
          return row ? toRecord(row) : null;
        },
        save: async (state: VaultState) => {
          const { vaultSeq } = await tx.user.update({
            where: { id: userId },
            data: { vaultSeq: { increment: 1 } },
            select: { vaultSeq: true },
          });
          const data = {
            seq: vaultSeq,
            updatedAt: BigInt(state.updatedAt),
            deleted: state.deleted,
            envelopeVersion: state.envelope.version,
            algorithm: state.envelope.algorithm,
            iv: state.envelope.iv,
            ciphertext: state.envelope.ciphertext,
          };
          const row = await tx.vaultEntry.upsert({
            where: { userId_id: { userId, id: state.id } },
            create: { userId, id: state.id, ...data },
            update: data,
          });
          return toRecord(row);
        },
      };
      return work(transaction);
    });
  }
}
