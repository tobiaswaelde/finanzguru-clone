import type { FinanceDatabase } from './drizzle.module.js';
import { account, institution, netWorthSnapshot, transaction } from './schema.js';
import { shiftDays, shiftMonths } from '../domain/period.js';

/** Populate an empty test database with five years of snapshots and 10,000 ledger rows. */
export function seedPerformance(db: FinanceDatabase, today = new Date().toISOString().slice(0, 10)): void {
  db.transaction((tx) => {
    if (tx.select({ id: account.id }).from(account).limit(1).get())
      throw new Error('Performance seed requires an empty database');
    const provider = tx.insert(institution).values({ name: 'Synthetic performance fixture' }).returning().get();
    const selected = tx
      .insert(account)
      .values({ institutionId: provider.id, type: 'checking', name: 'Perf cash', balanceCents: 10000000 })
      .returning()
      .get();
    const start = shiftMonths(today, -60);
    for (let date = start, i = 0; date <= today; date = shiftDays(date, 1), i++) {
      const valueCents = 10000000 - (1827 - i) * 100;
      tx.insert(netWorthSnapshot)
        .values({ accountId: selected.id, date, valueCents, investedCents: valueCents, externalFlowCents: 0 })
        .run();
    }
    for (let index = 0; index < 10000; index++) {
      tx.insert(transaction)
        .values({
          accountId: selected.id,
          bookingDate: shiftDays(today, -(index % 1800)),
          amountCents: index % 2 ? 100 : -100,
          type: index % 2 ? 'income' : 'expense',
          source: 'manual',
          fingerprint: `perf-${index}`,
          counterparty: 'Synthetic example',
        })
        .run();
    }
  });
}
