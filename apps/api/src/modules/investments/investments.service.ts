import { Inject, Injectable } from '@nestjs/common';
import type { investmentPositionQuerySchema, investmentPositionSchema } from '@finance/shared';
import { and, asc, desc, eq, inArray, lt } from 'drizzle-orm';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { account, instrument, positionLot, price, transaction } from '../../database/schema.js';
import { euroToCents, financeDecimal, sumCents } from '../../domain/money.js';
import { PositionBook } from '../../domain/positions.js';
import { OverviewService, type OverviewQuery } from '../overview/overview.service.js';

type Position = ReturnType<typeof investmentPositionSchema.parse>;
type PositionQuery = ReturnType<typeof investmentPositionQuerySchema.parse>;

/** Reads investment results limited to the selected visible depots. */
@Injectable()
export class InvestmentsService {
  constructor(
    @Inject(DB) private readonly db: FinanceDatabase,
    @Inject(OverviewService) private readonly overview: OverviewService,
  ) {}

  /** Resolve only visible investment accounts before querying any holdings. */
  depotIds(accounts?: string): string[] {
    return this.db
      .select({ id: account.id })
      .from(account)
      .where(
        and(
          eq(account.type, 'depot'),
          eq(account.isHidden, false),
          accounts ? inArray(account.id, accounts.split(',')) : undefined,
        ),
      )
      .all()
      .map(({ id }) => id);
  }

  /** Read group performance from the derived daily series. */
  performance(query: OverviewQuery) {
    const ids = this.depotIds(query.accounts);
    if (!ids.length) return { valueCents: null, gainCents: null, series: [] };
    const snapshot = this.overview.netWorth({ ...query, accounts: ids.join(',') });
    return {
      valueCents: snapshot.totalCents,
      gainCents: snapshot.gainCents,
      series: snapshot.series.map(({ date, valueCents, investedCents }) => ({ date, valueCents, investedCents })),
    };
  }

  /** Return a joined list of open or fully sold investments with consolidated values. */
  positions(query: PositionQuery): Position[] {
    const ids = this.depotIds(query.accounts);
    if (!ids.length) return [];
    const lots = this.db
      .select({ lot: positionLot, security: instrument })
      .from(positionLot)
      .innerJoin(instrument, eq(positionLot.instrumentId, instrument.id))
      .where(inArray(positionLot.accountId, ids))
      .all();
    const holdings = new Map<
      string,
      {
        security: typeof instrument.$inferSelect;
        quantity: InstanceType<typeof financeDecimal>;
        basis: InstanceType<typeof financeDecimal>;
      }
    >();
    for (const { lot, security } of lots) {
      const group = holdings.get(security.id) ?? {
        security,
        quantity: new financeDecimal(0),
        basis: new financeDecimal(0),
      };
      const quantity = new financeDecimal(lot.quantityOpen);
      group.quantity = group.quantity.plus(quantity);
      group.basis = group.basis.plus(quantity.times(lot.costPerUnit));
      holdings.set(security.id, group);
    }
    const ledger = this.db
      .select()
      .from(transaction)
      .where(inArray(transaction.accountId, ids))
      .orderBy(asc(transaction.bookingDate), asc(transaction.id))
      .all();
    const dividends = new Map<string, number>();
    const realized = new Map<string, number>();
    const books = new Map<string, PositionBook>();
    for (const row of ledger) {
      if (!row.instrumentId) continue;
      if (row.type === 'dividend') {
        dividends.set(
          row.instrumentId,
          sumCents([dividends.get(row.instrumentId) ?? 0, row.amountCents, -row.feeCents, -row.taxCents]),
        );
      } else if (
        query.status === 'sold' &&
        row.quantity &&
        (row.type === 'buy' || row.type === 'sell' || row.type === 'split')
      ) {
        const book = books.get(row.accountId) ?? new PositionBook();
        books.set(row.accountId, book);
        const before = book.realizedCents();
        book.apply({
          date: row.bookingDate,
          instrumentId: row.instrumentId,
          quantity: row.quantity,
          type: row.type,
          unitPrice: row.unitPrice ?? undefined,
          feeCents: row.feeCents,
          taxCents: row.taxCents,
        });
        if (row.type === 'sell')
          realized.set(
            row.instrumentId,
            sumCents([realized.get(row.instrumentId) ?? 0, book.realizedCents(), -before]),
          );
      }
    }
    const results: Position[] = [];
    for (const { security, quantity, basis } of holdings.values()) {
      const sold = quantity.isZero();
      if (sold !== (query.status === 'sold')) continue;
      const quote = this.db
        .select()
        .from(price)
        .where(eq(price.instrumentId, security.id))
        .orderBy(desc(price.date))
        .get();
      const previous = quote
        ? this.db
            .select()
            .from(price)
            .where(and(eq(price.instrumentId, security.id), lt(price.date, quote.date)))
            .orderBy(desc(price.date))
            .get()
        : undefined;
      const entryValueCents = euroToCents(basis);
      const valueCents = quote ? euroToCents(quantity.times(quote.close)) : entryValueCents;
      const gainCents = sold ? (realized.get(security.id) ?? 0) : sumCents([valueCents, -entryValueCents]);
      results.push({
        instrumentId: security.id,
        name: security.name,
        assetClass: security.assetClass,
        isin: security.isin,
        wkn: security.wkn,
        priceCents: quote ? euroToCents(quote.close) : null,
        dayChangePct:
          quote && previous ? new financeDecimal(quote.close).div(previous.close).minus(1).toNumber() : null,
        quantity: quantity.toFixed(),
        valueCents,
        entryValueCents,
        avgPrice: sold ? null : basis.div(quantity).toFixed(),
        gainCents,
        gainPct: entryValueCents ? gainCents / entryValueCents : null,
        allocationPct: null,
        dividendsCents: dividends.get(security.id) ?? 0,
        realizedCents: sold ? gainCents : undefined,
      });
    }
    const total = sumCents(results.map((row) => row.valueCents));
    return results
      .filter((row) => !query.assetClass || row.assetClass === query.assetClass)
      .map((row) => ({ ...row, allocationPct: total > 0 ? row.valueCents / total : null }))
      .sort((left, right) => right.valueCents - left.valueCents || left.name.localeCompare(right.name, 'de'));
  }

  /** Summarize value, position count and ratio by asset class. */
  classes(accounts?: string) {
    const positions = this.positions({ accounts, status: 'open' });
    const total = sumCents(positions.map((row) => row.valueCents));
    const grouped = new Map<Position['assetClass'], { valueCents: number; count: number }>();
    for (const row of positions) {
      const prior = grouped.get(row.assetClass);
      grouped.set(row.assetClass, {
        valueCents: sumCents([prior?.valueCents ?? 0, row.valueCents]),
        count: (prior?.count ?? 0) + 1,
      });
    }
    return [...grouped].map(([assetClass, row]) => ({
      assetClass,
      ...row,
      pct: total > 0 ? row.valueCents / total : null,
    }));
  }
}
