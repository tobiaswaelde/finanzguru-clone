import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { periodQuerySchema } from '@finance/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { account, netWorthSnapshot } from '../../database/schema.js';
import { sumCents } from '../../domain/money.js';
import { resolvePeriod } from '../../domain/period.js';
import { twror } from '../../domain/returns.js';

/** Query controls shared across overview reads. */
export type OverviewQuery = ReturnType<typeof periodQuerySchema.parse>;

/** Produces portfolio snapshots scoped to visible, selected accounts. */
@Injectable()
export class OverviewService {
  constructor(@Inject(DB) private readonly db: FinanceDatabase) {}

  /** Aggregate daily snapshots without exposing individual account records. */
  daily(query: OverviewQuery) {
    const s = netWorthSnapshot;
    const ids = query.accounts?.split(',');
    const rows = this.db
      .select({
        date: s.date,
        valueCents: sql<number>`sum(${s.valueCents})`.mapWith(Number),
        investedCents: sql<number>`sum(${s.investedCents})`.mapWith(Number),
        cashCents: sql<number>`sum(case when ${account.type} <> 'depot' then ${s.valueCents} else 0 end)`.mapWith(
          Number,
        ),
        externalFlowCents: sql<number>`sum(${s.externalFlowCents})`.mapWith(Number),
      })
      .from(s)
      .innerJoin(account, eq(s.accountId, account.id))
      .where(and(eq(account.isHidden, false), ids ? inArray(account.id, ids) : undefined))
      .groupBy(s.date)
      .orderBy(asc(s.date))
      .all();
    const latest = rows.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
    try {
      const range = resolvePeriod(query, latest, rows[0]?.date ?? latest);
      return rows.filter((row) => row.date >= range.from && row.date <= range.to);
    } catch {
      throw new BadRequestException();
    }
  }

  /** Compute net worth and sample the display series after calculating full-resolution returns. */
  netWorth(query: OverviewQuery) {
    const daily = this.daily(query);
    const first = daily[0];
    const last = daily.at(-1);
    if (!first || !last) return { totalCents: null, gainCents: null, gainPct: null, series: [] };
    let cumulative: number | null = first.valueCents > 0 ? 1 : null;
    const points = daily.map((point, index) => {
      const previous = daily[index - 1];
      if (previous && cumulative !== null) {
        const step = twror([previous, point]);
        cumulative = step === null ? null : cumulative * (1 + step);
      }
      return {
        date: point.date,
        valueCents: point.valueCents,
        investedCents: point.investedCents,
        cashCents: point.cashCents,
        returnPct: cumulative === null ? null : cumulative - 1,
      };
    });
    const count = Math.min(400, points.length);
    const series =
      count === points.length
        ? points
        : Array.from({ length: count }, (_, index) => points[Math.floor((index * (points.length - 1)) / (count - 1))]!);
    return {
      totalCents: last.valueCents,
      gainCents: sumCents([
        last.valueCents,
        -first.valueCents,
        ...daily.slice(1).map((entry) => -entry.externalFlowCents),
      ]),
      gainPct: twror(daily),
      series,
    };
  }
}
