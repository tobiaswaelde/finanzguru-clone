import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { expect, it } from 'vitest';
import { openDatabase } from '../../src/database/open-database.js';
import * as schema from '../../src/database/schema.js';
import { RecomputeService } from '../../src/modules/import/recompute.service.js';

it('recomputes cash with prior history while preserving earlier rows and caller rollback', () => {
  const connection = openDatabase(':memory:');
  try {
    const db = drizzle(connection, { schema });
    migrate(db, { migrationsFolder: join(__dirname, '../../src/database/migrations') });
    const inst = db.insert(schema.institution).values({ name: 'Test' }).returning().get();
    const cash = db
      .insert(schema.account)
      .values({ institutionId: inst.id, name: 'Cash', type: 'cash', balanceCents: 500 })
      .returning()
      .get();
    db.insert(schema.transaction)
      .values({
        accountId: cash.id,
        bookingDate: '2026-01-01',
        amountCents: 200,
        type: 'deposit',
        source: 'manual',
        fingerprint: 'test',
      })
      .run();
    const recompute = new RecomputeService();
    db.transaction((tx) => recompute.rebuild(tx, [cash.id], '2026-01-01', '2026-01-02'));
    expect(db.select().from(schema.netWorthSnapshot).all()).toMatchObject([
      { date: '2026-01-01', valueCents: 500, externalFlowCents: 200 },
      { date: '2026-01-02', valueCents: 500, externalFlowCents: 0 },
    ]);
    expect(() =>
      db.transaction((tx) => {
        tx.update(schema.account).set({ balanceCents: 750 }).run();
        recompute.rebuild(tx, [cash.id], '2026-01-02', '2026-01-02');
        tx.rollback();
      }),
    ).toThrow();
    expect(
      db
        .select()
        .from(schema.netWorthSnapshot)
        .all()
        .map((point) => point.valueCents),
    ).toEqual([500, 500]);
  } finally {
    connection.close();
  }
});
