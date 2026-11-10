import { describe, it, expect } from 'vitest';
import { parseMobile } from '../../../../src/modules/user/phone.js';

describe('parseMobile', () => {
  it('splits a valid number into calling code and national number', () => {
    expect(parseMobile('+91', '9876543210')).toEqual({ countryCode: '91', mobile: '9876543210' });
    expect(parseMobile('44', '7911123456')).toEqual({ countryCode: '44', mobile: '7911123456' });
  });

  it('rejects numbers that are not valid for the country', () => {
    expect(parseMobile('+91', '12345')).toBeNull();
    expect(parseMobile('+91', '0000000000')).toBeNull();
  });

  it('rejects an unknown calling code', () => {
    expect(parseMobile('+999', '9876543210')).toBeNull();
  });
});
