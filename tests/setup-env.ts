import { inject } from 'vitest';

// The Redis URL is only known once global setup has started the container.
process.env['REDIS_URL'] = inject('redisUrl');
