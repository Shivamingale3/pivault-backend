import { describe, it, expect, beforeEach } from 'vitest';
import { ulid } from 'ulid';
import { ConflictError, NotFoundError } from '../../../../src/core/errors/HttpErrors.js';
import { UserService } from '../../../../src/modules/user/UserService.js';
import { InMemoryUserRepository } from '../../../helpers/InMemoryUserRepository.js';

let repo: InMemoryUserRepository;
let service: UserService;

beforeEach(() => {
  repo = new InMemoryUserRepository();
  service = new UserService(repo);
});

async function seed(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await service.create({ email: `user${i}@example.com` });
  }
}

describe('UserService.list', () => {
  it('returns the requested page with correct metadata', async () => {
    await seed(5);
    const page = await service.list({ page: 2, pageSize: 2 });

    expect(page.items).toHaveLength(2);
    expect(page).toMatchObject({ page: 2, pageSize: 2, total: 5, totalPages: 3 });
  });

  it('returns the partial last page', async () => {
    await seed(5);
    const page = await service.list({ page: 3, pageSize: 2 });
    expect(page.items).toHaveLength(1);
  });

  it('returns an empty page past the end, and 0 pages when empty', async () => {
    expect(await service.list({ page: 1, pageSize: 20 })).toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
    await seed(1);
    expect((await service.list({ page: 9, pageSize: 20 })).items).toEqual([]);
  });
});

describe('UserService.getById', () => {
  it('returns an existing user', async () => {
    const created = await service.create({ email: 'a@example.com', name: 'A' });
    expect(await service.getById(created.id)).toEqual(created);
  });

  it('throws NotFoundError for a missing user', async () => {
    await expect(service.getById(ulid())).rejects.toThrow(NotFoundError);
    await expect(service.getById(ulid())).rejects.toThrow('User not found');
  });
});

describe('UserService.create', () => {
  it('passes data through and defaults name to null', async () => {
    const user = await service.create({ email: 'a@example.com' });
    expect(user).toMatchObject({ email: 'a@example.com', name: null });
    expect(repo.rows.size).toBe(1);
  });

  it('propagates the repository ConflictError for a duplicate email', async () => {
    await service.create({ email: 'a@example.com' });
    await expect(service.create({ email: 'a@example.com' })).rejects.toThrow(ConflictError);
  });
});

describe('UserService.update', () => {
  it('updates only the provided fields', async () => {
    const user = await service.create({ email: 'a@example.com', name: 'A' });
    const updated = await service.update(user.id, { name: 'B' });
    expect(updated).toMatchObject({ email: 'a@example.com', name: 'B' });
  });

  it('can clear the name with null', async () => {
    const user = await service.create({ email: 'a@example.com', name: 'A' });
    expect((await service.update(user.id, { name: null })).name).toBeNull();
  });

  it('throws NotFoundError for a missing user', async () => {
    await expect(service.update(ulid(), { name: 'x' })).rejects.toThrow(NotFoundError);
  });
});

describe('UserService.remove', () => {
  it('deletes an existing user', async () => {
    const user = await service.create({ email: 'a@example.com' });
    await service.remove(user.id);
    expect(repo.rows.size).toBe(0);
  });

  it('throws NotFoundError for a missing user', async () => {
    await expect(service.remove(ulid())).rejects.toThrow(NotFoundError);
  });
});
