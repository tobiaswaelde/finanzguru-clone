import { drizzle } from 'drizzle-orm/better-sqlite3';
import { openDatabase } from '../database/open-database.js';
import { owner } from '../database/schema.js';
import { hashPassword } from '../modules/auth/password.js';

/** Update the owner password using stdin so it is not stored in shell history or arguments. */
async function setPassword(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  }
  if (process.stdin.isTTY) throw new Error('Supply the password over stdin from a no-echo password prompt.');
  process.stdin.setEncoding('utf8');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 1026) throw new Error('Password must contain 12–1024 characters.');
  }
  const password = input.replace(/\r?\n$/u, '');
  if (password.length < 12 || password.length > 1024) throw new Error('Password must contain 12–1024 characters.');
  const hash = await hashPassword(password);
  const connection = openDatabase(process.env.DATABASE_PATH ?? './data/app.db');
  try {
    const db = drizzle(connection);
    db.transaction((tx) => {
      if (tx.select({ id: owner.id }).from(owner).get()) {
        tx.update(owner).set({ passwordHash: hash }).run();
      } else {
        tx.insert(owner)
          .values({ displayName: 'Inhaber', passwordHash: hash, createdAt: new Date().toISOString() })
          .run();
      }
    });
  } finally {
    connection.close();
  }
}

void setPassword().catch(() => {
  console.error('Unable to set owner password; ensure migrations ran and stdin contains 12–1024 characters.');
  process.exitCode = 1;
});
