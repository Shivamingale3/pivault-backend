import { generateKeyPairSync, sign } from 'node:crypto';
import { sha256Base64Url } from '../../src/core/crypto/bodyHash.js';
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
    /**
     * Headers for a request signed together with its body, as the current PWA does. `body` is the
     * exact text sent (supertest sends `JSON.stringify(object)`), or '' for none.
     */
    signedWithBody(
      token: string,
      method: string,
      path: string,
      body: string,
      timestamp = Date.now(),
    ) {
      const stamp = String(timestamp);
      const bodyHash = sha256Base64Url(body);
      const signature = sign(
        'sha256',
        Buffer.from(signaturePayload(stamp, method, path, bodyHash)),
        { key: privateKey, dsaEncoding: 'ieee-p1363' },
      ).toString('base64url');
      return {
        Authorization: `Bearer ${token}`,
        'X-Timestamp': stamp,
        'X-Signature': signature,
        'X-Body-SHA256': bodyHash,
      };
    },
  };
}
