import { eq } from 'drizzle-orm';
import { shiftDays, shiftMonths } from '../domain/period.js';
import { RecomputeService } from '../modules/import/recompute.service.js';
import type { FinanceDatabase } from './drizzle.module.js';
import { account, institution, instrument, price, transaction } from './schema.js';

export const demoStart = '2023-12-01';
export const demoEnd = '2026-11-22';
const holdings = [
  ['IE00B4L5Y983', 'Demo World ETF', 'etf', 2, 50, 60],
  ['IE00BKM4GZ66', 'Demo Emerging Markets ETF', 'etf', 3, 20, 25],
  ['IE00BDBRDM35', 'Demo Global Aggregate Bond ETF', 'etf', 4, 5, 6],
  ['US0378331005', 'Demo Apple', 'stock', 1, 100, 120],
  ['US5949181045', 'Demo Microsoft', 'stock', 1, 100, 115],
] as const;

/** Build a stable UUIDv7 in a reserved synthetic namespace. */
function demoId(index: number): string {
  return `018c2344-6400-7000-8f1c-${index.toString(16).padStart(12, '0')}`;
}

/** Insert a deterministic three-year ledger and derive its snapshots in one transaction. */
export function seedDemo(db: FinanceDatabase): void {
  db.transaction((tx) => {
    const institutionId = demoId(1);
    if (tx.select({ id: institution.id }).from(institution).where(eq(institution.id, institutionId)).get()) return;
    if (tx.select({ id: account.id }).from(account).limit(1).get()) {
      throw new Error('Seed demo data only into a disposable database without accounts');
    }
    tx.insert(institution).values({ id: institutionId, name: 'Demo-Institut' }).run();
    const depotId = demoId(2);
    const referenceId = demoId(3);
    const checkingId = demoId(4);
    tx.insert(account)
      .values([
        { id: depotId, institutionId, name: 'Demo-Depot', type: 'depot' },
        {
          id: referenceId,
          institutionId,
          name: 'Demo-Verrechnungskonto',
          type: 'reference',
          parentAccountId: depotId,
          balanceCents: 173300,
        },
        { id: checkingId, institutionId, name: 'Demo-Girokonto', type: 'checking', balanceCents: 6300000 },
      ])
      .run();
    let nextTx = 100;
    /** Append one synthetic booking with a stable ID and fingerprint. */
    const book = (values: Omit<typeof transaction.$inferInsert, 'id' | 'fingerprint' | 'source'>) => {
      const id = demoId(nextTx++);
      tx.insert(transaction)
        .values({ ...values, id, fingerprint: `demo:${id}`, source: 'manual' })
        .run();
    };
    for (const [index, [isin, name, assetClass, quantity, cost, final]] of holdings.entries()) {
      tx.insert(instrument)
        .values({ id: demoId(index + 10), name, isin, assetClass, currency: 'EUR' })
        .onConflictDoNothing({ target: instrument.isin })
        .run();
      const security = tx.select({ id: instrument.id }).from(instrument).where(eq(instrument.isin, isin)).get();
      if (!security) throw new Error('Demo instrument missing');
      const instrumentId = security.id;
      book({
        accountId: depotId,
        type: 'buy',
        bookingDate: demoStart,
        amountCents: -cost * quantity * 100,
        instrumentId,
        quantity: String(quantity),
        unitPrice: String(cost),
      });
      book({ accountId: referenceId, type: 'transfer', bookingDate: demoStart, amountCents: -cost * quantity * 100 });
      for (let date = demoStart; date <= demoEnd; date = shiftDays(date, 1)) {
        const close = date === demoEnd ? String(final) : (cost + (Number(date.slice(-2)) % 10) / 10).toFixed(2);
        tx.insert(price).values({ instrumentId, date, close, source: 'manual' }).onConflictDoNothing().run();
      }
      if (index === holdings.length - 1) {
        const bookingDate = '2025-06-01';
        book({
          accountId: depotId,
          type: 'sell',
          bookingDate,
          amountCents: 11300,
          instrumentId,
          quantity: '1',
          unitPrice: '113',
        });
        book({ accountId: referenceId, type: 'transfer', bookingDate, amountCents: 11300 });
      }
    }
    for (let month = 0; month < 36; month++) {
      const date = shiftMonths(demoStart, month);
      for (const [counterparty, amountCents] of [
        ['Demo-Gehalt', 300000],
        ['Demo-Miete', -100000],
        ['Demo-Supermarkt', -25000],
      ] as const) {
        book({
          accountId: checkingId,
          type: amountCents > 0 ? 'income' : 'expense',
          bookingDate: date,
          amountCents,
          counterparty,
        });
      }
    }
    new RecomputeService().rebuild(tx, [depotId, referenceId, checkingId], demoStart, demoEnd);
  });
}
