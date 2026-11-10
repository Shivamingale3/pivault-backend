import { parsePhoneNumberFromString } from 'libphonenumber-js';

export interface ParsedMobile {
  /** Calling-code digits without "+", e.g. "91". */
  countryCode: string;
  /** National significant number, digits only, e.g. "9876543210". */
  mobile: string;
}

/**
 * Validates a number against real numbering plans and splits it into the two stored
 * parts. Returns null when it is not a valid number for that country code.
 */
export function parseMobile(countryCode: string, nationalNumber: string): ParsedMobile | null {
  const code = countryCode.replace(/^\+/, '');
  const parsed = parsePhoneNumberFromString(`+${code}${nationalNumber}`);
  if (!parsed?.isValid() || parsed.countryCallingCode !== code) return null;
  return { countryCode: parsed.countryCallingCode, mobile: parsed.nationalNumber };
}
