import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { periodQuerySchema } from '@finance/shared';
import { and, asc, eq, inArray } from 'drizzle-orm';
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
    const snapshots = this.db
      .select({
        id: s.accountId,
        type: account.type,
        date: s.date,
        valueCents: s.valueCents,
        investedCents: s.investedCents,
        externalFlowCents: s.externalFlowCents,
      })
      .from(s)
      .innerJoin(account, eq(s.accountId, account.id))
      .where(and(eq(account.isHidden, false), ids ? inArray(account.id, ids) : undefined))
      .orderBy(asc(s.date))
      .all();
    // Imports rebuild only the affected account. Carry forward other accounts' last known values.
    const rows: {
      date: string;
      valueCents: number;
      investedCents: number;
      cashCents: number;
      externalFlowCents: number;
    }[] = [];
    const prior = new Map<string, (typeof snapshots)[number]>();
    let value = 0n;
    let invested = 0n;
    let cash = 0n;
    let flow = 0n;
    for (const [index, point] of snapshots.entries()) {
      const previous = prior.get(point.id);
      const delta = BigInt(point.valueCents) - BigInt(previous?.valueCents ?? 0);
      value += delta;
      invested += BigInt(point.investedCents) - BigInt(previous?.investedCents ?? 0);
      if (point.type !== 'depot') cash += delta;
      flow += BigInt(point.externalFlowCents);
      prior.set(point.id, point);
      if (snapshots[index + 1]?.date !== point.date) {
        rows.push({
          date: point.date,
          valueCents: Number(value),
          investedCents: Number(invested),
          cashCents: Number(cash),
          externalFlowCents: Number(flow),
        });
        flow = 0n;
      }
    }
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
