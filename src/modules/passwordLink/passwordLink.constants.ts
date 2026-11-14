/** One message for every bad link (unknown, expired, spent, malformed): no oracle for attackers. */
export const INVALID_LINK_MESSAGE = 'This link is invalid or has expired';

/** `randomBytes(32).toString('base64url')` is always 43 characters. */
export const LINK_TOKEN_LENGTH = 43;
