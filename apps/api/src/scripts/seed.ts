import { drizzle } from 'drizzle-orm/better-sqlite3';
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
  seedDefaults(drizzle(connection, { schema }));
} finally {
  connection.close();
}
