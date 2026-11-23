import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ruleInputSchema, type categoryInputSchema, type rulePatchSchema } from '@finance/shared';
import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { account, categorizationRule, category, transaction } from '../../database/schema.js';
import { compileRuleRegex, createCategorizer } from '../../domain/categorize.js';

type CategoryInput = ReturnType<typeof categoryInputSchema.parse>;
type RuleInput = ReturnType<typeof ruleInputSchema.parse>;

/** Manages the owner's category hierarchy and reusable review rules. */
@Injectable()
export class CategoriesService {
  constructor(@Inject(DB) private readonly db: FinanceDatabase) {}

  /** Return top-level categories including immediate children. */
  categories() {
    const rows = this.db.select().from(category).orderBy(asc(category.name)).all();
    return rows
      .filter((row) => !row.parentId)
      .map((row) => ({ ...row, children: rows.filter((child) => child.parentId === row.id) }));
  }

  /** Create a unique category at depth one or two. */
  createCategory(input: CategoryInput) {
    const values = { ...input, parentId: input.parentId ?? null };
    this.validateCategory(values);
    return this.db.insert(category).values(values).returning().get();
  }

  /** Change category details without allowing a deeper hierarchy. */
  patchCategory(id: string, patch: Partial<CategoryInput>) {
    const current = this.db.select().from(category).where(eq(category.id, id)).get();
    if (!current) throw new NotFoundException();
    const values = { ...current, ...patch };
    if (current.isDefault && (current.parentId !== values.parentId || current.kind !== values.kind))
      throw new ConflictException();
    this.validateCategory({ ...values, parentId: values.parentId ?? null }, id);
    if (!Object.keys(patch).length) return current;
    return this.db.update(category).set(patch).where(eq(category.id, id)).returning().get();
  }

  /** Refuse to delete a built-in category or orphan its children. */
  removeCategory(id: string): void {
    const row = this.db.select().from(category).where(eq(category.id, id)).get();
    if (!row) throw new NotFoundException();
    if (row.isDefault || this.db.select({ id: category.id }).from(category).where(eq(category.parentId, id)).get())
      throw new ConflictException();
    this.db.delete(category).where(eq(category.id, id)).run();
  }

  /** Enforce sibling uniqueness, matching parent kind, and two levels. */
  private validateCategory(input: CategoryInput & { parentId: string | null }, id?: string): void {
    const parentId = input.parentId;
    if (parentId) {
      const parent = this.db.select().from(category).where(eq(category.id, parentId)).get();
      if (!parent) throw new NotFoundException();
      if (parentId === id || parent.parentId || parent.kind !== input.kind) throw new BadRequestException();
      if (id && this.db.select({ id: category.id }).from(category).where(eq(category.parentId, id)).get())
        throw new ConflictException();
    }
    if (
      id &&
      this.db
        .select({ id: category.id })
        .from(category)
        .where(and(eq(category.parentId, id), ne(category.kind, input.kind)))
        .get()
    )
      throw new ConflictException();
    const duplicate = this.db
      .select({ id: category.id })
      .from(category)
      .where(
        and(
          parentId ? eq(category.parentId, parentId) : isNull(category.parentId),
          eq(category.name, input.name),
          id ? ne(category.id, id) : undefined,
        ),
      )
      .get();
    if (duplicate) throw new ConflictException();
  }

  /** Return rules in execution order. */
  rules() {
    return this.db.select().from(categorizationRule).orderBy(asc(categorizationRule.priority)).all();
  }

  /** Add a rule with a valid RE2 pattern and unique priority. */
  createRule(input: RuleInput) {
    this.validateRule(input);
    return this.db.insert(categorizationRule).values(input).returning().get();
  }

  /** Replace fields after revalidating the complete merged rule. */
  patchRule(id: string, patch: ReturnType<typeof rulePatchSchema.parse>) {
    const current = this.db.select().from(categorizationRule).where(eq(categorizationRule.id, id)).get();
    if (!current) throw new NotFoundException();
    const merged = ruleInputSchema.safeParse({ ...current, ...patch });
    if (!merged.success) throw new BadRequestException();
    this.validateRule(merged.data, id);
    return this.db.update(categorizationRule).set(merged.data).where(eq(categorizationRule.id, id)).returning().get();
  }

  /** Remove one rule without changing historical transactions. */
  removeRule(id: string): void {
    if (!this.db.delete(categorizationRule).where(eq(categorizationRule.id, id)).run().changes)
      throw new NotFoundException();
  }

  /** Verify references, priority, and the exact runtime regex dialect. */
  private validateRule(input: RuleInput, id?: string): void {
    if (!this.db.select({ id: category.id }).from(category).where(eq(category.id, input.categoryId)).get())
      throw new NotFoundException();
    if (
      this.db
        .select({ id: categorizationRule.id })
        .from(categorizationRule)
        .where(and(eq(categorizationRule.priority, input.priority), id ? ne(categorizationRule.id, id) : undefined))
        .get()
    )
      throw new ConflictException();
    if (input.operator === 'regex') {
      try {
        compileRuleRegex(input.pattern);
      } catch {
        throw new BadRequestException();
      }
    }
  }

  /** Apply current rules to unreviewed visible rows without overwriting manual classification. */
  apply(): { updated: number } {
    return this.db.transaction((tx) => {
      const categorize = createCategorizer(
        this.rules(),
        tx
          .select({ iban: account.iban })
          .from(account)
          .all()
          .flatMap(({ iban }) => (iban ? [iban] : [])),
      );
      const rows = tx
        .select({ row: transaction })
        .from(transaction)
        .innerJoin(account, eq(account.id, transaction.accountId))
        .where(and(eq(account.isHidden, false), eq(transaction.reviewStatus, 'unreviewed')))
        .all();
      let updated = 0;
      for (const { row } of rows) {
        const next = categorize(row);
        if (next.type === row.type && next.categoryId === row.categoryId && next.categorySource === row.categorySource)
          continue;
        tx.update(transaction)
          .set({ type: next.type, categoryId: next.categoryId, categorySource: next.categorySource })
          .where(eq(transaction.id, row.id))
          .run();
        updated++;
      }
      return { updated };
    });
  }
}
