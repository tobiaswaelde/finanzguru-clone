import { eq } from 'drizzle-orm';
import { expect, it } from 'vitest';
import { account, dataSource, importJob, transaction } from '../../src/database/schema.js';
import { ImportPipeline } from '../../src/modules/import/import.pipeline.js';
import { RecomputeService } from '../../src/modules/import/recompute.service.js';
import { ownerApp } from '../helpers/owner-app.js';

it('imports identical genuine bookings once and reports partial errors independently', async () => {
  const { app, db } = await ownerApp();
  try {
    const sourceId = db.select().from(dataSource).where(eq(dataSource.kind, 'csv')).get()?.id;
    if (!sourceId) throw new Error('Missing CSV provider fixture');
    /** Start a durable job for one invocation of the pipeline. */
    const job = () =>
      db
        .insert(importJob)
        .values({
          sourceId,
          kind: 'csv_upload',
          status: 'running',
          startedAt: new Date().toISOString(),
        })
        .returning()
        .get().id;
    const booking = {
      accountExternalRef: 'demo',
      bookingDate: '2026-01-01',
      amountCents: 250,
      type: 'income' as const,
    };
    const batch = {
      accounts: [{ externalRef: 'demo', name: 'Demo', institutionName: 'Bank Demo', type: 'checking' as const }],
      instruments: [],
      prices: [],
      transactions: [booking, booking],
      rowErrors: [{ line: 4, reason: 'invalid_amount' }],
    };
    const pipeline = new ImportPipeline(db, new RecomputeService());
    expect(pipeline.run(job(), batch)).toMatchObject({ imported: 2, skipped: 0, failed: 1, status: 'partial' });
    expect(pipeline.run(job(), batch)).toMatchObject({ imported: 0, skipped: 2, failed: 1, status: 'partial' });
    expect(db.select().from(transaction).all()).toHaveLength(2);
    expect(db.select().from(account).get()).toMatchObject({ balanceCents: 500 });
    const rollback = new ImportPipeline(db, {
      rebuild() {
        throw new Error('synthetic derivation failure');
      },
    });
    expect(
      rollback.run(job(), { ...batch, transactions: [{ ...booking, amountCents: 300 }], rowErrors: [] }),
    ).toMatchObject({ imported: 0, failed: 1, status: 'failed', errors: [{ reason: 'import_rolled_back' }] });
    expect(db.select().from(transaction).all()).toHaveLength(2);
    expect(db.select().from(account).get()).toMatchObject({ balanceCents: 500 });
  } finally {
    await app.close();
  }
});
