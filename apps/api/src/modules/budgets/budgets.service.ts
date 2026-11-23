import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { budgetInputSchema } from '@finance/shared';
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { account, budget, category, transaction } from '../../database/schema.js';
import { sumCents } from '../../domain/money.js';
import { calendarRange } from '../../domain/period.js';

type BudgetInput = ReturnType<typeof budgetInputSchema.parse>;

/** Manages expense budgets and derives spending from the live monthly ledger. */
@Injectable()
export class BudgetsService {
  constructor(@Inject(DB) private readonly db: FinanceDatabase) {}

  /** List every budget with spent and remaining cents for the current UTC month. */
  list(accounts?: string) {
    return this.db
      .select()
      .from(budget)
      .orderBy(asc(budget.createdAt))
      .all()
      .map((row) => this.withSpend(row, accounts));
  }

  /** Create one budget for an expense category. */
  create(input: BudgetInput) {
    this.validate(input.categoryId);
    const row = this.db
      .insert(budget)
      .values({ ...input, createdAt: new Date().toISOString() })
      .returning()
      .get();
    return this.withSpend(row);
  }

  /** Update the limit or category of an existing budget. */
  patch(id: string, input: Partial<BudgetInput>) {
    const row = this.db.select().from(budget).where(eq(budget.id, id)).get();
    if (!row) throw new NotFoundException();
    const next = {
      categoryId: input.categoryId ?? row.categoryId,
      monthlyLimitCents: input.monthlyLimitCents ?? row.monthlyLimitCents,
    };
    this.validate(next.categoryId, id);
    return this.withSpend(this.db.update(budget).set(next).where(eq(budget.id, id)).returning().get());
  }

  /** Delete the limit without deleting transactions. */
  remove(id: string): void {
    if (!this.db.delete(budget).where(eq(budget.id, id)).run().changes) throw new NotFoundException();
  }

  /** Validate category kind and uniqueness before persisting. */
  private validate(categoryId: string, current?: string): void {
    const match = this.db.select().from(category).where(eq(category.id, categoryId)).get();
    if (!match) throw new NotFoundException();
    if (match.kind !== 'expense') throw new BadRequestException();
    const existing = this.db.select({ id: budget.id }).from(budget).where(eq(budget.categoryId, categoryId)).get();
    if (existing && existing.id !== current) throw new ConflictException();
  }

  /** Sum qualifying negative bookings for the budget category and its children. */
  private withSpend(row: typeof budget.$inferSelect, accounts?: string) {
    const range = calendarRange('month', new Date().toISOString().slice(0, 10));
    const children = this.db
      .select({ id: category.id })
      .from(category)
      .where(eq(category.parentId, row.categoryId))
      .all();
    const result = this.db
      .select({ total: sql<number>`coalesce(sum(-${transaction.amountCents}), 0)`.mapWith(Number) })
      .from(transaction)
      .innerJoin(account, eq(account.id, transaction.accountId))
      .where(
        and(
          eq(account.isHidden, false),
          accounts ? inArray(account.id, accounts.split(',')) : undefined,
          inArray(transaction.categoryId, [row.categoryId, ...children.map(({ id }) => id)]),
          gte(transaction.bookingDate, range.from),
          lte(transaction.bookingDate, range.to),
          sql`${transaction.amountCents} < 0 AND ${transaction.type} NOT IN ('transfer', 'buy', 'sell', 'split', 'deposit', 'withdrawal')`,
        ),
      )
      .get();
    const spentCents = result?.total ?? 0;
    return { ...row, spentCents, remainingCents: sumCents([row.monthlyLimitCents, -spentCents]) };
  }
}
