import { createPublicKey, type KeyObject } from 'node:crypto';

/**
 * Parses the device public key sent on login: SPKI DER, base64url, ECDSA on P-256.
 * Returns null for anything else (wrong curve, RSA, garbage), so a session can never hold a key
 * that can't verify request signatures.
 */
export function parseDevicePublicKey(value: string): KeyObject | null {
  try {
    const key = createPublicKey({
      key: Buffer.from(value, 'base64url'),
      format: 'der',
      type: 'spki',
    });
    const isP256 =
      key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails?.namedCurve === 'prime256v1';
    return isP256 ? key : null;
  } catch {
    return null;
  }
}
