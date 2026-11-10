import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const IMAGE = 'redis:8.2-alpine';
const READY_TIMEOUT_MS = 15_000;

export interface TestRedis {
  url: string;
  stop: () => void;
}

function docker(args: string[]): string {
  const result = spawnSync('docker', args, { stdio: 'pipe', encoding: 'utf8' });
  if (result.error) throw new Error(`docker is not available: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`docker ${args[0] ?? ''} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

/**
 * Starts a throwaway Redis for the test run: localhost-only, random host port,
 * no persistence, removed on stop. Dev and prod use the native REDIS_URL instead.
 */
export async function startTestRedis(): Promise<TestRedis> {
  const name = `pivault-test-redis-${process.pid}`;
  docker([
    'run',
    '-d',
    '--rm',
    '--name',
    name,
    '-p',
    '127.0.0.1::6379',
    IMAGE,
    'redis-server',
    '--save',
    '',
    '--appendonly',
    'no',
  ]);
  const stop = () => {
    spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
  };

  try {
    // e.g. "127.0.0.1:49162"
    const mapped = docker(['port', name, '6379/tcp']).split('\n')[0] ?? '';
    const port = mapped.slice(mapped.lastIndexOf(':') + 1);
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (docker(['exec', name, 'redis-cli', 'ping']) !== 'PONG') {
      if (Date.now() > deadline) throw new Error('Test Redis did not become ready in time');
      await sleep(100);
    }
    return { url: `redis://127.0.0.1:${port}/0`, stop };
  } catch (error) {
    stop();
    throw error;
  }
}
