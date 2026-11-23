import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  investmentExportColumns,
  type investmentPositionQuerySchema,
  type investmentPositionSchema,
  type investmentTransactionsQuerySchema,
} from '@finance/shared';
import { and, asc, count, desc, eq, gte, inArray, lt, lte } from 'drizzle-orm';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { account, instrument, positionLot, price, transaction } from '../../database/schema.js';
import { euroToCents, financeDecimal, sumCents } from '../../domain/money.js';
import { resolvePeriod } from '../../domain/period.js';
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

  /** Return a bounded page of portfolio bookings scoped before the count and page queries. */
  transactions(query: ReturnType<typeof investmentTransactionsQuerySchema.parse>) {
    const ids = this.depotIds(query.accounts);
    if (query.from && query.to && query.from > query.to) throw new BadRequestException();
    if (!ids.length) return { items: [], total: 0 };
    const scope = and(
      inArray(transaction.accountId, ids),
      query.type ? eq(transaction.type, query.type) : undefined,
      query.from ? gte(transaction.bookingDate, query.from) : undefined,
      query.to ? lte(transaction.bookingDate, query.to) : undefined,
    );
    return {
      items: this.db
        .select()
        .from(transaction)
        .where(scope)
        .orderBy(desc(transaction.bookingDate), desc(transaction.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize)
        .all(),
      total: this.db.select({ total: count() }).from(transaction).where(scope).get()?.total ?? 0,
    };
  }

  /** Return one investment only if it belongs to a selected visible depot. */
  detail(id: string, query: OverviewQuery) {
    const pos =
      this.positions({ status: 'open', accounts: query.accounts }).find((row) => row.instrumentId === id) ??
      this.positions({ status: 'sold', accounts: query.accounts }).find((row) => row.instrumentId === id);
    const item = pos && this.db.select().from(instrument).where(eq(instrument.id, id)).get();
    if (!item || !pos) throw new NotFoundException();
    const prices = this.db
      .select({ date: price.date, close: price.close })
      .from(price)
      .where(eq(price.instrumentId, id))
      .orderBy(asc(price.date))
      .all();
    const latest = prices.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
    let range;
    try {
      range = resolvePeriod(query, latest, prices[0]?.date ?? latest);
    } catch {
      throw new BadRequestException();
    }
    const ids = this.depotIds(query.accounts);
    const ledger = this.db
      .select()
      .from(transaction)
      .where(
        and(
          inArray(transaction.accountId, ids),
          eq(transaction.instrumentId, id),
          gte(transaction.bookingDate, range.from),
          lte(transaction.bookingDate, range.to),
        ),
      )
      .orderBy(desc(transaction.bookingDate), desc(transaction.id))
      .limit(200)
      .all();
    return {
      instrument: item,
      position: pos,
      series: prices.filter((row) => row.date >= range.from && row.date <= range.to),
      transactions: ledger,
    };
  }

  /** Export only selected columns, quoting separators and neutralizing spreadsheet formula text. */
  csv(query: PositionQuery & { columns?: string }): string {
    type Column = (typeof investmentExportColumns)[number];
    const available = new Set<string>(investmentExportColumns);
    const requested = query.columns?.split(',') ?? [...investmentExportColumns];
    if (requested.some((field) => !available.has(field)) || new Set(requested).size !== requested.length)
      throw new BadRequestException();
    const columns = requested as Column[];
    /** Serialize a cell without interpreting imported labels as spreadsheet formulas. */
    function cell(field: Column, value: Position[Column]): string {
      if (value === null || value === undefined) return '';
      const text =
        field.endsWith('Cents') && typeof value === 'number'
          ? (value / 100).toFixed(2).replace('.', ',')
          : field.endsWith('Pct') && typeof value === 'number'
            ? `${new financeDecimal(value).times(100).toFixed(4).replace('.', ',')}%`
            : field === 'quantity' || field === 'avgPrice'
              ? String(value).replace('.', ',')
              : /^[\s]*[=+@-]/u.test(String(value))
                ? `'${String(value)}`
                : String(value);
      return `"${text.replace(/"/gu, '""')}"`;
    }
    return (
      '\uFEFF' +
      [
        columns.join(';'),
        ...this.positions(query).map((row) => columns.map((field) => cell(field, row[field])).join(';')),
      ].join('\r\n') +
      '\r\n'
    );
  }
}
