import { Injectable } from '@nestjs/common';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import type { FinanceTransaction } from '../../database/drizzle.module.js';
import { account, netWorthSnapshot, positionLot, price, transaction } from '../../database/schema.js';
import { sumCents } from '../../domain/money.js';
import { PositionBook } from '../../domain/positions.js';
import { buildSnapshots } from '../../domain/snapshots.js';

/** Rebuilds derived data inside the caller's atomic write. */
@Injectable()
export class RecomputeService {
  /** Replay prerequisite history, replacing only snapshots on or after `from`. */
  rebuild(
    tx: FinanceTransaction,
    accountIds: readonly string[],
    from: string,
    to = new Date().toISOString().slice(0, 10),
  ): void {
    for (const id of new Set(accountIds)) {
      const current = tx.select().from(account).where(eq(account.id, id)).get();
      if (!current) throw new Error('Cannot recompute a missing account');
      const ledger = tx
        .select()
        .from(transaction)
        .where(and(eq(transaction.accountId, id), lte(transaction.bookingDate, to)))
        .orderBy(asc(transaction.bookingDate), asc(transaction.id))
        .all();
      const depot = current.type === 'depot';
      const book = new PositionBook();
      const ids = new Set<string>();
      const events = ledger.map((row) => {
        const { instrumentId, quantity, unitPrice, type, bookingDate, amountCents, feeCents, taxCents } = row;
        if (instrumentId) ids.add(instrumentId);
        const event = {
          date: bookingDate,
          type,
          amountCents,
          instrumentId: instrumentId ?? undefined,
          quantity: quantity ?? undefined,
          unitPrice: unitPrice ?? undefined,
          feeCents,
          taxCents,
        };
        if (depot && instrumentId && quantity && (type === 'buy' || type === 'sell' || type === 'split')) {
          book.apply({ ...event, instrumentId, quantity, type });
        }
        return event;
      });
      const prices = ids.size
        ? tx
            .select()
            .from(price)
            .where(and(inArray(price.instrumentId, [...ids]), lte(price.date, to)))
            .all()
        : [];
      const openingCashCents = depot ? 0 : sumCents([current.balanceCents, ...ledger.map((row) => -row.amountCents)]);
      const points = buildSnapshots({ depot, openingCashCents, from, to, events, prices });
      tx.delete(netWorthSnapshot)
        .where(and(eq(netWorthSnapshot.accountId, id), gte(netWorthSnapshot.date, from)))
        .run();
      tx.delete(positionLot).where(eq(positionLot.accountId, id)).run();
      for (const point of points) {
        tx.insert(netWorthSnapshot)
          .values({ ...point, accountId: id })
          .run();
      }
      for (const lot of book.getLots()) {
        tx.insert(positionLot)
          .values({ ...lot, accountId: id, closed: lot.quantityOpen === '0' })
          .run();
      }
    }
  }
}
