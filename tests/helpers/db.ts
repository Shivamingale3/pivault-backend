import { AppConfig } from '../../src/core/config/AppConfig.js';
import { PrismaDatabase } from '../../src/core/database/PrismaDatabase.js';

/** Test-database handle (DATABASE_URL is forced to TEST_DATABASE_URL). */
export const database = new PrismaDatabase(AppConfig.fromEnvironment().databaseUrl);
export const db = database.client;

/** Clears users (sessions cascade). Use in beforeEach() of DB integration tests. */
export async function truncateUsers(): Promise<void> {
  await db.session.deleteMany({});
  await db.user.deleteMany({});
}
