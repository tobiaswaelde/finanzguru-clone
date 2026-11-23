import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { expect, it } from 'vitest';
import { seedDemo } from '../../src/database/demo.js';
import { openDatabase } from '../../src/database/open-database.js';
import * as schema from '../../src/database/schema.js';

it('derives the recorded demo totals and does not duplicate data on a second seed', () => {
  const expected = JSON.parse(readFileSync(join(__dirname, '../fixtures/demo-expected.json'), 'utf8'));
  const connection = openDatabase(':memory:');
  try {
    const db = drizzle(connection, { schema });
    migrate(db, { migrationsFolder: join(__dirname, '../../src/database/migrations') });
    seedDemo(db);
    seedDemo(db);
    const points = db
      .select()
      .from(schema.netWorthSnapshot)
      .where(eq(schema.netWorthSnapshot.date, expected.asOf))
      .all();
    expect(points.map((point) => point.valueCents)).toEqual([
      expected.depotCents,
      expected.referenceCents,
      expected.checkingCents,
    ]);
    expect(points.reduce((total, point) => total + point.valueCents, 0)).toBe(expected.totalCents);
    expect(db.select().from(schema.positionLot).where(eq(schema.positionLot.closed, true)).all()).toHaveLength(
      expected.closedPositions,
    );
    expect(db.select().from(schema.transaction).all()).toHaveLength(expected.transactions);
  } finally {
    connection.close();
  }
});
