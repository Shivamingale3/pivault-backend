/**
 * Domain shapes for the user module. Services depend on these, never on
 * Prisma-generated types, so the persistence layer stays swappable.
 */

/** Public user profile. Never carries the password hash. */
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  passwordChangedAt: Date | null;
  recoveryKeyConfiguredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Only for credential checks (login). Keep it inside the auth flow. */
export interface UserWithPasswordHash extends User {
  passwordHash: string;
}

export interface CreateUserData {
  firstName: string;
  lastName: string;
  /** Already normalised (trimmed, lower-cased). */
  email: string;
  /** Already normalised to E.164. */
  mobile: string;
  passwordHash: string;
}

/** Fields that must be unique across users. */
export type UniqueUserField = 'email' | 'mobile';
