import { createHash, timingSafeEqual } from 'node:crypto';

/** SHA-256 as lowercase hex. Used for session/reset tokens: high-entropy secrets, not passwords. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Constant-time string comparison; false (not throw) on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
