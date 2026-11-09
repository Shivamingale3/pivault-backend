import { AppConfig } from '../../src/core/config/AppConfig.js';
import { PrismaDatabase } from '../../src/core/database/PrismaDatabase.js';

/** Test-database handle (DATABASE_URL is forced to TEST_DATABASE_URL). */
export const database = new PrismaDatabase(AppConfig.fromEnvironment().databaseUrl);
export const db = database.client;

/**
 * Truncates the users table between tests for isolation.
 * Use in beforeEach() of integration tests that hit the DB.
 */
export async function truncateUsers(): Promise<void> {
  await db.user.deleteMany({});
}
