import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { parseDevicePublicKey } from '../../../../src/modules/auth/devicePublicKey.js';
import { createDevice } from '../../../helpers/deviceKey.js';

const toSpki = (key: KeyObject): string =>
  key.export({ format: 'der', type: 'spki' }).toString('base64url');

describe('parseDevicePublicKey', () => {
  it('accepts an ECDSA P-256 SPKI key', () => {
    expect(parseDevicePublicKey(createDevice().publicKey)).not.toBeNull();
  });

  it('rejects other curves, other key types and garbage', () => {
    expect(
      parseDevicePublicKey(toSpki(generateKeyPairSync('ec', { namedCurve: 'P-384' }).publicKey)),
    ).toBeNull();
    expect(
      parseDevicePublicKey(toSpki(generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey)),
    ).toBeNull();
    expect(parseDevicePublicKey('not a key')).toBeNull();
    expect(parseDevicePublicKey('')).toBeNull();
  });
});
