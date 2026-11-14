import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { HttpServer } from '../../../src/core/app/HttpServer.js';
import { ResourceGroup } from '../../../src/core/lifecycle/ResourceGroup.js';
import { createFakeLogger, createFakeResource } from '../../helpers/fakes.js';

function build() {
  const app = express();
  app.get('/ping', (_req, res) => {
    res.send('pong');
  });
  const database = createFakeResource('database');
  const dependency = createFakeResource('dependency');
  const logger = createFakeLogger();
  const server = new HttpServer(app, new ResourceGroup([database, dependency], logger), logger, 0);
  return { server, database, dependency };
}

let active: HttpServer | null = null;

afterEach(async () => {
  await active?.stop();
  active = null;
});

describe('HttpServer', () => {
  it('connects every resource before listening and serves requests', async () => {
    const { server, database, dependency } = build();
    active = server;
    const port = await server.start();

    expect(database.connect).toHaveBeenCalledOnce();
    expect(dependency.connect).toHaveBeenCalledOnce();
    expect(port).toBeGreaterThan(0);
    const res = await request(`http://127.0.0.1:${port}`).get('/ping');
    expect(res.text).toBe('pong');
  });

  it('stop() closes the listener and disconnects resources', async () => {
    const { server, database, dependency } = build();
    const port = await server.start();
    await server.stop();

    expect(database.disconnect).toHaveBeenCalledOnce();
    expect(dependency.disconnect).toHaveBeenCalledOnce();
    await expect(request(`http://127.0.0.1:${port}`).get('/ping')).rejects.toThrow();
  });

  it('does not listen when a resource fails, and releases the ones already connected', async () => {
    const { server, database, dependency } = build();
    dependency.connect.mockRejectedValueOnce(new Error('dependency down'));
    await expect(server.start()).rejects.toThrow('dependency down');
    expect(database.disconnect).toHaveBeenCalledOnce();
  });

  it('stop() before start() is a safe no-op', async () => {
    const { server, database } = build();
    await server.stop();
    expect(database.disconnect).not.toHaveBeenCalled();
  });
});
