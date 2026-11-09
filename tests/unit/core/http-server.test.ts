import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { HttpServer } from '../../../src/core/app/HttpServer.js';
import { createFakeDatabase, createFakeLogger } from '../../helpers/fakes.js';

function build() {
  const app = express();
  app.get('/ping', (_req, res) => {
    res.send('pong');
  });
  const database = createFakeDatabase();
  const server = new HttpServer(app, database, createFakeLogger(), 0);
  return { server, database };
}

let active: HttpServer | null = null;

afterEach(async () => {
  await active?.stop();
  active = null;
});

describe('HttpServer', () => {
  it('connects the database before listening and serves requests', async () => {
    const { server, database } = build();
    active = server;
    const port = await server.start();

    expect(database.connect).toHaveBeenCalledOnce();
    expect(port).toBeGreaterThan(0);
    const res = await request(`http://127.0.0.1:${port}`).get('/ping');
    expect(res.text).toBe('pong');
  });

  it('stop() closes the listener and disconnects the database', async () => {
    const { server, database } = build();
    const port = await server.start();
    await server.stop();

    expect(database.disconnect).toHaveBeenCalledOnce();
    await expect(request(`http://127.0.0.1:${port}`).get('/ping')).rejects.toThrow();
  });

  it('does not listen when the database connection fails', async () => {
    const { server, database } = build();
    database.connect.mockRejectedValueOnce(new Error('db down'));
    await expect(server.start()).rejects.toThrow('db down');
  });

  it('stop() before start() still disconnects safely', async () => {
    const { server, database } = build();
    await server.stop();
    expect(database.disconnect).toHaveBeenCalledOnce();
  });
});
