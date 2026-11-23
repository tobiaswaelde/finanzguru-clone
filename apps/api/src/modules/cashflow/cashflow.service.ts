import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { cashflowQuerySchema } from '@finance/shared';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { account, category, transaction } from '../../database/schema.js';
import { cashflowSankey, summarizeCashflow, summarizeCategories } from '../../domain/cashflow.js';
import { calendarRange, shiftMonths } from '../../domain/period.js';

type Query = ReturnType<typeof cashflowQuerySchema.parse>;

/** Runs owner-scoped financial flow aggregation over the stored ledger. */
@Injectable()
export class CashflowService {
  constructor(@Inject(DB) private readonly db: FinanceDatabase) {}

  /** Resolve the date bounds and query only account-scoped rows in that window. */
  private window(query: Query, fullHistory = false) {
    const today = new Date().toISOString().slice(0, 10);
    const anchor = query.anchor ?? today;
    const range = calendarRange(query.granularity, anchor);
    const months = query.granularity === 'year' ? 132 : query.granularity === 'quarter' ? 33 : 11;
    let start: string;
    try {
      start = fullHistory ? shiftMonths(range.from, -months) : range.from;
    } catch {
      throw new BadRequestException();
    }
    const rows = this.db
      .select({
        bookingDate: transaction.bookingDate,
        type: transaction.type,
        amountCents: transaction.amountCents,
        categoryId: transaction.categoryId,
      })
      .from(transaction)
      .innerJoin(account, eq(account.id, transaction.accountId))
      .where(
        and(
          eq(account.isHidden, false),
          query.accounts ? inArray(account.id, query.accounts.split(',')) : undefined,
          gte(transaction.bookingDate, start),
          lte(transaction.bookingDate, range.to),
        ),
      )
      .all();
    return { rows, range, anchor, today };
  }

  /** Compute the selected period and twelve period bars. */
  summary(query: Query) {
    const window = this.window(query, true);
    return summarizeCashflow(window.rows, query.granularity, window.anchor, window.today);
  }

  /** Return grouped income or expenses with transaction counts. */
  categories(query: Query, kind: 'income' | 'expense') {
    const window = this.window(query);
    return summarizeCategories(window.rows, this.db.select().from(category).all(), window.range, kind);
  }

  /** Return the flow graph for the selected period. */
  sankey(query: Query) {
    const window = this.window(query);
    return cashflowSankey(window.rows, this.db.select().from(category).all(), window.range);
  }
}
