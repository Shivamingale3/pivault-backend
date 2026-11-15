import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaVaultRepository } from '../../src/modules/vault/PrismaVaultRepository.js';
import { db, truncateUsers } from '../helpers/db.js';
import { userData } from '../helpers/fixtures.js';
import { fakeState, nextVersion } from '../helpers/vaultFixtures.js';

const repo = new PrismaVaultRepository(db);
let alice: string;
let bob: string;

beforeAll(async () => {
  await db.$connect();
});
beforeEach(async () => {
  await truncateUsers();
  alice = (await db.user.create({ data: userData() })).id;
  bob = (await db.user.create({ data: userData() })).id;
});
afterAll(async () => {
  await truncateUsers();
  await db.$disconnect();
});

describe('PrismaVaultRepository', () => {
  it('numbers saves 1, 2, 3... per user and keeps the user counter in step', async () => {
    const [a, b] = [fakeState(), fakeState()];
    await repo.runExclusive(alice, async (tx) => {
      expect((await tx.save(a)).seq).toBe(1);
      expect((await tx.save(b)).seq).toBe(2);
    });
    await repo.runExclusive(bob, async (tx) => {
      expect((await tx.save(fakeState())).seq).toBe(1);
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: alice } })).vaultSeq).toBe(2n);
    expect((await db.user.findUniqueOrThrow({ where: { id: bob } })).vaultSeq).toBe(1n);
  });

  it('round-trips the envelope exactly and replaces an entry in place with a new number', async () => {
    const v1 = fakeState();
    await repo.runExclusive(alice, (tx) => tx.save(v1));
    const v2 = nextVersion(v1, { deleted: true });
    await repo.runExclusive(alice, async (tx) => {
      expect(await tx.find(v1.id)).toMatchObject({ seq: 1, envelope: v1.envelope });
      await tx.save(v2);
    });

    const stored = await repo.listAfter(alice, 0, 10);
    expect(stored).toEqual([{ ...v2, seq: 2 }]);
    expect(await db.vaultEntry.count({ where: { userId: alice } })).toBe(1);
  });

  it('lists in change order, after a number, up to a limit', async () => {
    const states = Array.from({ length: 4 }, () => fakeState());
    await repo.runExclusive(alice, async (tx) => {
      for (const state of states) await tx.save(state);
    });
    expect((await repo.listAfter(alice, 0, 10)).map((r) => r.seq)).toEqual([1, 2, 3, 4]);
    expect((await repo.listAfter(alice, 2, 10)).map((r) => r.seq)).toEqual([3, 4]);
    expect((await repo.listAfter(alice, 0, 2)).map((r) => r.id)).toEqual([
      states[0]?.id,
      states[1]?.id,
    ]);
  });

  it('keeps users apart, and lets two users hold the same entry id', async () => {
    const state = fakeState();
    await repo.runExclusive(alice, (tx) => tx.save(state));
    await repo.runExclusive(bob, async (tx) => {
      expect(await tx.find(state.id)).toBeNull();
      await tx.save({ ...state, updatedAt: state.updatedAt + 9 });
    });
    expect((await repo.listAfter(alice, 0, 10))[0]?.updatedAt).toBe(state.updatedAt);
    expect((await repo.listAfter(bob, 0, 10))[0]?.updatedAt).toBe(state.updatedAt + 9);
  });

  it('rolls back everything, including the numbers, when the work fails', async () => {
    await expect(
      repo.runExclusive(alice, async (tx) => {
        await tx.save(fakeState());
        await tx.save(fakeState());
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await repo.listAfter(alice, 0, 10)).toEqual([]);
    expect((await db.user.findUniqueOrThrow({ where: { id: alice } })).vaultSeq).toBe(0n);
  });

  it('serializes parallel pushes of one user: no number is skipped or used twice', async () => {
    await Promise.all(
      Array.from({ length: 5 }, () =>
        repo.runExclusive(alice, async (tx) => {
          for (let i = 0; i < 3; i += 1) await tx.save(fakeState());
        }),
      ),
    );
    const seqs = (await repo.listAfter(alice, 0, 100)).map((r) => r.seq);
    expect(seqs).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it('deletes a user’s entries with the user', async () => {
    await repo.runExclusive(alice, (tx) => tx.save(fakeState()));
    await db.user.delete({ where: { id: alice } });
    expect(await db.vaultEntry.count()).toBe(0);
  });
});
