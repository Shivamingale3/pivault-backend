/**
 * Domain shapes for the user module. Services and controllers depend on these,
 * never on Prisma-generated types, so the persistence layer stays swappable.
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  name?: string | undefined;
}

export interface UpdateUserData {
  email?: string | undefined;
  /** `null` clears the name. */
  name?: string | null | undefined;
}
