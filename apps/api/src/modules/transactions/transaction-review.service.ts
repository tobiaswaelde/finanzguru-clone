import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ruleInputSchema, type transactionListQuerySchema, type transactionReviewSchema } from '@finance/shared';
import { and, count, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { account, categorizationRule, category, transaction } from '../../database/schema.js';
import { compileRuleRegex } from '../../domain/categorize.js';

const investmentKinds = new Set(['buy', 'sell', 'split', 'dividend']);

/** Lists and reviews the owner's bookings without exposing hidden account data. */
@Injectable()
export class TransactionReviewService {
  constructor(@Inject(DB) private readonly db: FinanceDatabase) {}

  /** Apply filters before computing either the page or the total. */
  list(query: ReturnType<typeof transactionListQuerySchema.parse>) {
    if (query.from && query.to && query.from > query.to) throw new BadRequestException();
    const term = query.q?.toLowerCase();
    const categoryFilter =
      query.categoryId === 'none' || query.uncategorized === 'true'
        ? isNull(transaction.categoryId)
        : query.categoryId
          ? eq(transaction.categoryId, query.categoryId)
          : undefined;
    const scope = and(
      eq(account.isHidden, false),
      query.accounts ? inArray(account.id, query.accounts.split(',')) : undefined,
      categoryFilter,
      query.status ? eq(transaction.reviewStatus, query.status) : undefined,
      query.from ? gte(transaction.bookingDate, query.from) : undefined,
      query.to ? lte(transaction.bookingDate, query.to) : undefined,
      term
        ? or(
            sql`instr(lower(${transaction.counterparty}), ${term}) > 0`,
            sql`instr(lower(${transaction.purpose}), ${term}) > 0`,
          )
        : undefined,
    );
    return {
      items: this.db
        .select({ row: transaction })
        .from(transaction)
        .innerJoin(account, eq(account.id, transaction.accountId))
        .where(scope)
        .orderBy(desc(transaction.bookingDate), desc(transaction.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize)
        .all()
        .map(({ row }) => row),
      total:
        this.db
          .select({ total: count() })
          .from(transaction)
          .innerJoin(account, eq(account.id, transaction.accountId))
          .where(scope)
          .get()?.total ?? 0,
    };
  }

  /** Apply an explicit category as a manual edit and optionally create a matching rule. */
  review(id: string, input: ReturnType<typeof transactionReviewSchema.parse>) {
    return this.db.transaction((tx) => {
      const selected = tx
        .select({ row: transaction })
        .from(transaction)
        .innerJoin(account, eq(account.id, transaction.accountId))
        .where(and(eq(transaction.id, id), eq(account.isHidden, false)))
        .get()?.row;
      if (!selected) throw new NotFoundException();
      if (
        input.type &&
        input.type !== selected.type &&
        (investmentKinds.has(input.type) || investmentKinds.has(selected.type))
      )
        throw new BadRequestException();
      const categoryId = input.categoryId === undefined ? selected.categoryId : input.categoryId;
      if (categoryId && !tx.select({ id: category.id }).from(category).where(eq(category.id, categoryId)).get())
        throw new NotFoundException();
      if (input.createRule) {
        if (!categoryId) throw new BadRequestException();
        const last = tx
          .select({ priority: categorizationRule.priority })
          .from(categorizationRule)
          .orderBy(desc(categorizationRule.priority))
          .get();
        const rule = ruleInputSchema.safeParse({
          ...input.createRule,
          categoryId,
          priority: (last?.priority ?? -1) + 1,
        });
        if (!rule.success) throw new BadRequestException();
        if (rule.data.operator === 'regex') {
          try {
            compileRuleRegex(rule.data.pattern);
          } catch {
            throw new BadRequestException();
          }
        }
        tx.insert(categorizationRule).values(rule.data).run();
      }
      return tx
        .update(transaction)
        .set({
          categoryId,
          categorySource: input.categoryId === undefined ? selected.categorySource : categoryId ? 'manual' : null,
          reviewStatus:
            input.reviewStatus ??
            (input.categoryId === undefined ? selected.reviewStatus : categoryId ? 'reviewed' : 'unreviewed'),
          type: input.type ?? selected.type,
        })
        .where(eq(transaction.id, id))
        .returning()
        .get();
    });
  }
}
