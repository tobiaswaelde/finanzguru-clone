import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { expect, it } from 'vitest';
import { openDatabase } from '../../src/database/open-database.js';
import * as schema from '../../src/database/schema.js';
import { seedDefaults } from '../../src/database/seed.js';

it('seeds German defaults idempotently without changing source state', () => {
  const connection = openDatabase(':memory:');
  try {
    const db = drizzle(connection, { schema });
    migrate(db, { migrationsFolder: join(__dirname, '../../src/database/migrations') });
    seedDefaults(db);
    const categories = db.select().from(schema.category).all();
    expect(categories).toHaveLength(21);
    expect(categories.every((category) => category.isDefault)).toBe(true);
    db.update(schema.dataSource).set({ status: 'disabled' }).where(eq(schema.dataSource.kind, 'csv')).run();
    seedDefaults(db);
    expect(db.select().from(schema.category).all()).toEqual(categories);
    expect(db.select().from(schema.institution).all()).toHaveLength(1);
    expect(db.select().from(schema.dataSource).all()).toMatchObject([
      { kind: 'csv', status: 'disabled' },
      { kind: 'sparkasse_fints', status: 'planned' },
    ]);
  } finally {
    connection.close();
  }
});
