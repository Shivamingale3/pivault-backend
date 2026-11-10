import { describe, it, expect } from 'vitest';
import { ResourceGroup } from '../../../src/core/lifecycle/ResourceGroup.js';
import { createFakeLogger, createFakeResource } from '../../helpers/fakes.js';

function setup() {
  const order: string[] = [];
  const make = (name: string, ping = true) => {
    const resource = createFakeResource(name, ping);
    resource.connect.mockImplementation(() => {
      order.push(`connect:${name}`);
      return Promise.resolve();
    });
    resource.disconnect.mockImplementation(() => {
      order.push(`disconnect:${name}`);
      return Promise.resolve();
    });
    return resource;
  };
  return { order, make, logger: createFakeLogger() };
}

describe('ResourceGroup', () => {
  it('connects in order and disconnects in reverse', async () => {
    const { order, make, logger } = setup();
    const group = new ResourceGroup([make('database'), make('redis'), make('workers')], logger);
    await group.connectAll();
    await group.disconnectAll();
    expect(order).toEqual([
      'connect:database',
      'connect:redis',
      'connect:workers',
      'disconnect:workers',
      'disconnect:redis',
      'disconnect:database',
    ]);
  });

  it('rolls back what connected when a later resource fails', async () => {
    const { order, make, logger } = setup();
    const redis = make('redis');
    redis.connect.mockRejectedValueOnce(new Error('nope'));
    const group = new ResourceGroup([make('database'), redis, make('workers')], logger);
    await expect(group.connectAll()).rejects.toThrow('nope');
    expect(order).toEqual(['connect:database', 'disconnect:database']);
    expect(logger.error).toHaveBeenCalled();
  });

  it('keeps disconnecting when one resource fails to close', async () => {
    const { make, logger } = setup();
    const database = make('database');
    const redis = make('redis');
    redis.disconnect.mockRejectedValueOnce(new Error('stuck'));
    const group = new ResourceGroup([database, redis], logger);
    await group.connectAll();
    await expect(group.disconnectAll()).resolves.toBeUndefined();
    expect(database.disconnect).toHaveBeenCalledOnce();
  });

  it('reports each resource in pingAll()', async () => {
    const { make, logger } = setup();
    const group = new ResourceGroup([make('database'), make('redis', false)], logger);
    await expect(group.pingAll()).resolves.toEqual({ database: true, redis: false });
  });
});
