import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { openDatabase } from './open-database.js';

/** Apply pending migrations to the given SQLite file, closing it on completion. */
export function migrateDatabase(path: string): void {
  const connection = openDatabase(path);
  try {
    migrate(drizzle(connection), { migrationsFolder: join(__dirname, 'migrations') });
  } finally {
    connection.close();
  }
}
