import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { ulid } from 'ulid';
import { createTestContainer } from '../helpers/app.js';
import { database, truncateUsers } from '../helpers/db.js';

const container = createTestContainer();
const { app } = container;

beforeEach(async () => {
  await truncateUsers();
});

afterAll(async () => {
  await Promise.all([database.disconnect(), container.database.disconnect()]);
});

const createUser = (body: object) => request(app).post('/api/users').send(body);

describe('User CRUD (happy path)', () => {
  it('creates, reads, updates and deletes a user', async () => {
    const created = await createUser({ email: '  Ann@Example.com ', name: 'Ann' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      success: true,
      message: 'User created successfully',
      data: { email: 'ann@example.com', name: 'Ann' },
    });
    const { id } = created.body.data;
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    const fetched = await request(app).get(`/api/users/${id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data).toEqual(created.body.data);

    const updated = await request(app).patch(`/api/users/${id}`).send({ name: null });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ id, email: 'ann@example.com', name: null });

    const deleted = await request(app).delete(`/api/users/${id}`);
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe('');

    expect((await request(app).get(`/api/users/${id}`)).status).toBe(404);
  });

  it('never accepts a client-supplied id', async () => {
    const forced = ulid();
    const res = await createUser({ email: 'a@example.com', id: forced });
    expect(res.status).toBe(201);
    expect(res.body.data.id).not.toBe(forced);
  });
});

describe('GET /api/users (pagination)', () => {
  it('paginates newest first with metadata', async () => {
    for (const email of ['1@x.io', '2@x.io', '3@x.io']) await createUser({ email });

    const first = await request(app).get('/api/users?page=1&pageSize=2');
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(first.body.data.items.map((u: { email: string }) => u.email)).toEqual([
      '3@x.io',
      '2@x.io',
    ]);

    const second = await request(app).get('/api/users?page=2&pageSize=2');
    expect(second.body.data.items).toHaveLength(1);
  });

  it('returns an empty first page when there are no users', async () => {
    const res = await request(app).get('/api/users');
    expect(res.body.data).toEqual({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
  });

  it('rejects an out-of-range pageSize', async () => {
    const res = await request(app).get('/api/users?pageSize=500');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'pageSize must be at most 100' });
  });
});

describe('Conflicts', () => {
  it('409 on creating a duplicate email (case-insensitive)', async () => {
    await createUser({ email: 'dup@example.com' });
    const res = await createUser({ email: 'DUP@example.com' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'Email already in use' });
  });

  it('409 on updating to an email that is taken', async () => {
    await createUser({ email: 'taken@example.com' });
    const other = await createUser({ email: 'other@example.com' });
    const res = await request(app)
      .patch(`/api/users/${other.body.data.id}`)
      .send({ email: 'taken@example.com' });
    expect(res.status).toBe(409);
  });
});

describe('Not found and validation errors', () => {
  it.each(['get', 'patch', 'delete'] as const)('404 on %s for a missing id', async (method) => {
    const res = await request(app)[method](`/api/users/${ulid()}`).send({ name: 'x' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'User not found' });
  });

  it('400 on a malformed id', async () => {
    const res = await request(app).get('/api/users/123');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('id must be a valid ULID');
  });

  it('400 on an invalid email', async () => {
    const res = await createUser({ email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('email must be a valid email address');
  });

  it('400 on an empty PATCH body', async () => {
    const res = await request(app).patch(`/api/users/${ulid()}`).send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('At least one field (email, name) must be provided');
  });
});
