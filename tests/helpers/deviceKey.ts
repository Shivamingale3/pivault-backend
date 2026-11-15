import { generateKeyPairSync, sign } from 'node:crypto';
import { signaturePayload } from '../../src/modules/session/session.constants.js';

/** A fake device: an ECDSA P-256 key pair like the PWA's, plus signed-request headers. */
export function createDevice() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return {
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64url'),
    /** Headers for an authenticated request, signed the way the PWA signs (raw r||s, base64url). */
    signedHeaders(token: string, method: string, path: string, timestamp = Date.now()) {
      const stamp = String(timestamp);
      const signature = sign('sha256', Buffer.from(signaturePayload(stamp, method, path)), {
        key: privateKey,
        dsaEncoding: 'ieee-p1363',
      }).toString('base64url');
      return { Authorization: `Bearer ${token}`, 'X-Timestamp': stamp, 'X-Signature': signature };
    },
  };
}
