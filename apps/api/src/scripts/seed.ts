import { drizzle } from 'drizzle-orm/better-sqlite3';
import { seedDemo } from '../database/demo.js';
import { openDatabase } from '../database/open-database.js';
import * as schema from '../database/schema.js';
import { seedDefaults } from '../database/seed.js';

try {
  process.loadEnvFile();
} catch (error) {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
}
const connection = openDatabase(process.env.DATABASE_PATH ?? './data/app.db');
try {
  const db = drizzle(connection, { schema });
  seedDefaults(db);
  if (process.argv.includes('--demo')) seedDemo(db);
} finally {
  connection.close();
}
