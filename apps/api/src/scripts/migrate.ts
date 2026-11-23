import { migrateDatabase } from '../database/migrate.js';

try {
  process.loadEnvFile();
} catch (error) {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
    throw error;
  }
}
migrateDatabase(process.env.DATABASE_PATH ?? './data/app.db');
