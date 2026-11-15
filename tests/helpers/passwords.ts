import { randomBytes } from 'node:crypto';

/**
 * A random fake password that satisfies the account policy (16 chars: upper, lower, digit,
 * special). Tests build passwords at runtime instead of writing literals, so secret scanners
 * (GitGuardian "Generic Password") have nothing to match, whatever the path config says.
 */
export const fakePassword = (): string => `${randomBytes(6).toString('hex')}Aa1!`;
