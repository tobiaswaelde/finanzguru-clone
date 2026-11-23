import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { expect, it } from 'vitest';
import { migrateDatabase } from '../../src/database/migrate.js';
import { openDatabase } from '../../src/database/open-database.js';
import { account, category, owner } from '../../src/database/schema.js';

it('initializes a new file and preserves data when migrations are rerun', () => {
  const root = mkdtempSync(join(tmpdir(), 'finance-migration-'));
  const path = join(root, 'test.db');
  try {
    migrateDatabase(path);
    const connection = openDatabase(path);
    try {
      const db = drizzle(connection);
      const row = { displayName: 'Demo', passwordHash: 'placeholder', createdAt: '2026-01-01T00:00:00Z' };
      expect(db.insert(owner).values(row).returning().get().id).toMatch(/^[\da-f]{8}-[\da-f]{4}-7/);
      expect(() => db.insert(owner).values(row).run()).toThrow();
      expect(() => db.insert(account).values({ institutionId: 'missing', name: 'Demo', type: 'cash' }).run()).toThrow();
      const rootCategory = { name: 'Demo', kind: 'expense', color: 'neutral' } as const;
      db.insert(category).values(rootCategory).run();
      expect(() => db.insert(category).values(rootCategory).run()).toThrow();
      migrateDatabase(path);
      expect(db.select().from(owner).all()).toHaveLength(1);
      expect(connection.pragma('foreign_key_check')).toEqual([]);
      expect(connection.pragma('integrity_check', { simple: true })).toBe('ok');
    } finally {
      connection.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
