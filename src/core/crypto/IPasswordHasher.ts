/** Account-password hashing (never used for the vault key). */
export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  /** Resolves false (never throws) for a wrong password or a malformed hash. */
  verify(hash: string, password: string): Promise<boolean>;
}
