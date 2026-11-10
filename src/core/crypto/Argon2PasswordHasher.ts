import argon2 from 'argon2';
import type { IPasswordHasher } from './IPasswordHasher.js';

/** argon2id with the library's current defaults (salted per hash, parameters embedded in it). */
export class Argon2PasswordHasher implements IPasswordHasher {
  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}
