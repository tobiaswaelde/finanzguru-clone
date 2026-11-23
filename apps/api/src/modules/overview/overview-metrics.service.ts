import { Inject, Injectable } from '@nestjs/common';
import type { allocationSchema, holdingQuerySchema, kpisSchema } from '@finance/shared';
import { and, asc, desc, eq, inArray, lte } from 'drizzle-orm';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { account, instrument, owner, positionLot, price, transaction } from '../../database/schema.js';
import { euroToCents, financeDecimal, sumCents } from '../../domain/money.js';
import { shiftDays, shiftMonths } from '../../domain/period.js';
import { PositionBook } from '../../domain/positions.js';
import { realReturn, twror, xirr } from '../../domain/returns.js';
import { OverviewService, type OverviewQuery } from './overview.service.js';

type Slice = ReturnType<typeof allocationSchema.parse>['slices'][number];
type Rates = ReturnType<typeof kpisSchema.parse>;
const labels: Record<Slice['key'], string> = {
  stock: 'Aktien',
  etf: 'ETF',
  fund: 'Fonds',
  bond: 'Anleihen',
  crypto: 'Krypto',
  commodity: 'Rohstoffe',
  other: 'Sonstige',
  cash: 'Liquidität',
};

/** Computes dashboard metrics from scoped accounts and the derived position ledger. */
@Injectable()
export class OverviewMetricsService {
  constructor(
    @Inject(DB) private readonly db: FinanceDatabase,
    @Inject(OverviewService) private readonly overview: OverviewService,
  ) {}

  /** Read only visible accounts selected by the query. */
  private accounts(accept?: string) {
    return this.db
      .select()
      .from(account)
      .where(and(eq(account.isHidden, false), accept ? inArray(account.id, accept.split(',')) : undefined))
      .all();
  }

  /** Aggregate open lots across the selected depots without mixing their cost basis. */
  private openPositions(ids: string[]) {
    if (!ids.length) return [];
    const rows = this.db
      .select({
        instrumentId: instrument.id,
        name: instrument.name,
        assetClass: instrument.assetClass,
        quantity: positionLot.quantityOpen,
        costPerUnit: positionLot.costPerUnit,
      })
      .from(positionLot)
      .innerJoin(instrument, eq(instrument.id, positionLot.instrumentId))
      .where(and(inArray(positionLot.accountId, ids), eq(positionLot.closed, false)))
      .all();
    const result = new Map<
      string,
      {
        instrumentId: string;
        name: string;
        assetClass: typeof instrument.$inferSelect.assetClass;
        quantity: InstanceType<typeof financeDecimal>;
        cost: InstanceType<typeof financeDecimal>;
      }
    >();
    for (const row of rows) {
      const prior = result.get(row.instrumentId);
      const quantity = new financeDecimal(row.quantity);
      const cost = quantity.times(row.costPerUnit);
      result.set(row.instrumentId, {
        ...row,
        quantity: (prior?.quantity ?? new financeDecimal(0)).plus(quantity),
        cost: (prior?.cost ?? new financeDecimal(0)).plus(cost),
      });
    }
    return [...result.values()];
  }

  /** Read the most recent closing price at or before a given date. */
  private quote(id: string, date?: string) {
    return this.db
      .select()
      .from(price)
      .where(and(eq(price.instrumentId, id), date ? lte(price.date, date) : undefined))
      .orderBy(desc(price.date))
      .limit(1)
      .get();
  }

  /** Group market value and current cash balances by asset class. */
  allocation(accept?: string) {
    const accounts = this.accounts(accept);
    const values = new Map<Slice['key'], { value: InstanceType<typeof financeDecimal>; count: number }>();
    /** Accumulate unrounded euro values to preserve cents until presentation. */
    const add = (key: Slice['key'], value: InstanceType<typeof financeDecimal>) => {
      const prior = values.get(key);
      values.set(key, { value: prior ? prior.value.plus(value) : value, count: (prior?.count ?? 0) + 1 });
    };
    for (const selected of accounts) {
      if (selected.type !== 'depot') add('cash', new financeDecimal(selected.balanceCents).div(100));
    }
    for (const position of this.openPositions(accounts.map((row) => row.id))) {
      const quote = this.quote(position.instrumentId);
      add(position.assetClass, quote ? position.quantity.times(quote.close) : position.cost);
    }
    const totals = [...values].map(([key, { value, count }]) => ({
      key,
      label: labels[key],
      count,
      valueCents: euroToCents(value),
    }));
    const totalCents = sumCents(totals.map((slice) => slice.valueCents));
    return {
      totalCents,
      slices: totals.map((slice) => ({ ...slice, pct: totalCents ? slice.valueCents / totalCents : null })),
    };
  }

  /** Return distinct top gainers and losers by period price change. */
  holdings(query: ReturnType<typeof holdingQuerySchema.parse>) {
    const items = this.openPositions(this.accounts(query.accounts).map((row) => row.id)).flatMap((item) => {
      const current = this.quote(item.instrumentId);
      if (!current) return [];
      const from =
        query.range === '1D'
          ? shiftDays(current.date, -1)
          : query.range === '1W'
            ? shiftDays(current.date, -7)
            : shiftMonths(current.date, query.range === '1M' ? -1 : -12);
      const prior = this.quote(item.instrumentId, from);
      if (!prior) return [];
      const close = new financeDecimal(current.close);
      return [
        {
          instrumentId: item.instrumentId,
          name: item.name,
          priceCents: euroToCents(close),
          changePct: close.div(prior.close).minus(1).toNumber(),
          changeCents: euroToCents(close.minus(prior.close)),
        },
      ];
    });
    return {
      top: items
        .filter((item) => item.changePct >= 0)
        .sort((a, b) => b.changePct - a.changePct)
        .slice(0, 5),
      flop: items
        .filter((item) => item.changePct < 0)
        .sort((a, b) => a.changePct - b.changePct)
        .slice(0, 5),
    };
  }

  /** Calculate realized and income figures plus the rates for the selected period. */
  kpis(query: OverviewQuery): Rates {
    const daily = this.overview.daily(query);
    const first = daily[0];
    const last = daily.at(-1);
    const ids = this.accounts(query.accounts).map((row) => row.id);
    const transactions =
      ids.length && first && last
        ? this.db
            .select()
            .from(transaction)
            .where(and(inArray(transaction.accountId, ids), lte(transaction.bookingDate, last.date)))
            .orderBy(asc(transaction.bookingDate), asc(transaction.id))
            .all()
        : [];
    const rangeRows = first ? transactions.filter((row) => row.bookingDate >= first.date) : [];
    const books = new Map<string, PositionBook>();
    const openingBooks = new Map<string, PositionBook>();
    let realizedGross = 0;
    let realizedNet = 0;
    let soldBasis = 0;
    for (const row of transactions) {
      if (!row.instrumentId || !row.quantity || (row.type !== 'buy' && row.type !== 'sell' && row.type !== 'split'))
        continue;
      const book = books.get(row.accountId) ?? new PositionBook();
      books.set(row.accountId, book);
      const before = book.realizedCents();
      const trade = {
        date: row.bookingDate,
        instrumentId: row.instrumentId,
        quantity: row.quantity,
        type: row.type,
        unitPrice: row.unitPrice ?? undefined,
        feeCents: row.feeCents,
        taxCents: row.taxCents,
      };
      book.apply(trade);
      if (first && row.bookingDate < first.date) {
        const opening = openingBooks.get(row.accountId) ?? new PositionBook();
        opening.apply(trade);
        openingBooks.set(row.accountId, opening);
      }
      if (row.type === 'sell' && first && row.bookingDate >= first.date) {
        const change = book.realizedCents() - before;
        realizedNet = sumCents([realizedNet, change]);
        realizedGross = sumCents([realizedGross, change, row.feeCents, row.taxCents]);
        soldBasis = sumCents([
          soldBasis,
          euroToCents(new financeDecimal(row.quantity).times(row.unitPrice ?? '0')),
          -row.feeCents,
          -row.taxCents,
          -change,
        ]);
      }
    }
    /** Sum gross and net interest or dividends from the selected ledger. */
    const income = (kind: 'dividend' | 'interest') => {
      const rows = rangeRows.filter((row) => row.type === kind);
      const grossCents = sumCents(rows.map((row) => row.amountCents));
      return { grossCents, netCents: sumCents([grossCents, ...rows.flatMap((row) => [-row.feeCents, -row.taxCents])]) };
    };
    const dividends = income('dividend');
    const interest = income('interest');
    const taxesFeesCents = sumCents(
      rangeRows.flatMap((row) => [
        row.feeCents,
        row.taxCents,
        row.type === 'fee' || row.type === 'tax' ? Math.abs(row.amountCents) : 0,
      ]),
    );
    const totalReturnCents =
      first && last
        ? sumCents([last.valueCents, -first.valueCents, ...daily.slice(1).map((row) => -row.externalFlowCents)])
        : null;
    const rate = twror(daily);
    const irr =
      first && last
        ? xirr([
            { date: first.date, amountCents: -first.valueCents },
            ...daily
              .slice(1)
              .filter((point) => point.externalFlowCents !== 0)
              .map((point) => ({ date: point.date, amountCents: -point.externalFlowCents })),
            { date: last.date, amountCents: last.valueCents },
          ])
        : null;
    const inflation = this.db.select({ value: owner.inflationRate }).from(owner).get()?.value ?? '0.0253';
    /** Keep finite rates as plain decimal strings for transport. */
    const text = (value: number | null) =>
      value !== null && Number.isFinite(value) ? new financeDecimal(value).toFixed() : null;
    /** Value unsold lots relative to their cost basis at the requested boundary. */
    const unrealized = (positions: Map<string, PositionBook>, asOf: string): number => {
      let gain = new financeDecimal(0);
      for (const book of positions.values()) {
        for (const lot of book.getLots()) {
          if (lot.quantityOpen === '0') continue;
          const quote = this.quote(lot.instrumentId, asOf);
          if (quote) gain = gain.plus(new financeDecimal(quote.close).minus(lot.costPerUnit).times(lot.quantityOpen));
        }
      }
      return euroToCents(gain);
    };
    const priceGain =
      first && last ? sumCents([unrealized(books, last.date), -unrealized(openingBooks, first.date)]) : 0;
    const otherGainsCents =
      totalReturnCents === null
        ? 0
        : sumCents([totalReturnCents, -priceGain, -realizedNet, -dividends.netCents, -interest.netCents]);
    return {
      investedCents: last?.investedCents ?? null,
      priceGain: { cents: priceGain, pct: first?.investedCents ? priceGain / first.investedCents : null },
      realized: {
        grossCents: realizedGross,
        netCents: realizedNet,
        pct: soldBasis > 0 ? realizedNet / soldBasis : null,
      },
      otherGainsCents,
      dividends,
      interest,
      taxesFeesCents,
      totalReturnCents,
      twror: text(rate),
      irr: text(irr),
      inflation,
      realReturn: text(realReturn(rate, Number(inflation))),
    };
  }
}
