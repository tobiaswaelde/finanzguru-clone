import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { manualAccountSchema, patchAccountSchema } from '@finance/shared';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { account, institution, netWorthSnapshot, transaction } from '../../database/schema.js';
import { sumCents } from '../../domain/money.js';
import { RecomputeService } from '../import/recompute.service.js';

/** Reads owner-visible accounts and account-scoped transaction counts. */
@Injectable()
export class AccountsService {
  constructor(
    @Inject(DB) private readonly db: FinanceDatabase,
    @Inject(RecomputeService) private readonly recompute: RecomputeService,
  ) {}

  /** Add an account against an existing institution or the seeded manual institution. */
  create(input: ReturnType<typeof manualAccountSchema.parse>) {
    const institutionId =
      input.institutionId ??
      this.db.select({ id: institution.id }).from(institution).where(eq(institution.name, 'Manuell')).get()?.id;
    if (!institutionId) throw new BadRequestException();
    this.validateRelations(institutionId, input.parentAccountId);
    const iban = input.iban?.replace(/\s/gu, '').toUpperCase() ?? null;
    this.assertIbanAvailable(iban);
    return this.db.transaction((tx) => {
      const row = tx
        .insert(account)
        .values({ ...input, institutionId, iban })
        .returning()
        .get();
      this.recompute.rebuild(tx, [row.id], new Date().toISOString().slice(0, 10));
      return row;
    });
  }

  /** Update metadata and rebuild historical balances when the current balance changes. */
  patch(id: string, patch: ReturnType<typeof patchAccountSchema.parse>) {
    const existing = this.db.select().from(account).where(eq(account.id, id)).get();
    if (!existing) throw new NotFoundException();
    this.validateRelations(patch.institutionId ?? existing.institutionId, patch.parentAccountId, id);
    const iban = patch.iban === undefined ? undefined : (patch.iban?.replace(/\s/gu, '').toUpperCase() ?? null);
    this.assertIbanAvailable(iban, id);
    if (patch.type && patch.type !== existing.type && this.hasBookings(id)) throw new ConflictException();
    if (!Object.keys(patch).length) return existing;
    return this.db.transaction((tx) => {
      const row = tx
        .update(account)
        .set({ ...patch, iban })
        .where(eq(account.id, id))
        .returning()
        .get();
      if (patch.balanceCents !== undefined || patch.type !== undefined) {
        const first = tx
          .select({ date: netWorthSnapshot.date })
          .from(netWorthSnapshot)
          .where(eq(netWorthSnapshot.accountId, id))
          .orderBy(asc(netWorthSnapshot.date))
          .get()?.date;
        this.recompute.rebuild(tx, [id], first ?? new Date().toISOString().slice(0, 10));
      }
      return row;
    });
  }

  /** Delete an account atomically, requiring force when it contains bookings. */
  remove(id: string, force: boolean): void {
    if (!this.db.select({ id: account.id }).from(account).where(eq(account.id, id)).get())
      throw new NotFoundException();
    this.db.transaction((tx) => {
      if (this.hasBookings(id) && !force) throw new ConflictException();
      if (force) tx.delete(transaction).where(eq(transaction.accountId, id)).run();
      tx.delete(account).where(eq(account.id, id)).run();
    });
  }

  /** Check whether the current account has financial records. */
  private hasBookings(id: string): boolean {
    return !!this.db
      .select({ id: transaction.id })
      .from(transaction)
      .where(eq(transaction.accountId, id))
      .limit(1)
      .get();
  }

  /** Reject duplicate values independently of display whitespace. */
  private assertIbanAvailable(iban: string | null | undefined, id?: string): void {
    if (!iban) return;
    const row = this.db.select({ id: account.id }).from(account).where(eq(account.iban, iban)).get();
    if (row && row.id !== id) throw new ConflictException();
  }

  /** Check parent references and prevent self-parenting and account cycles. */
  private validateRelations(institutionId: string, parentId?: string | null, current?: string): void {
    if (!this.db.select({ id: institution.id }).from(institution).where(eq(institution.id, institutionId)).get())
      throw new NotFoundException();
    const seen = new Set<string>(current ? [current] : []);
    while (parentId) {
      if (seen.has(parentId)) throw new BadRequestException();
      seen.add(parentId);
      const parent = this.db
        .select({ parentId: account.parentAccountId })
        .from(account)
        .where(eq(account.id, parentId))
        .get();
      if (!parent) throw new NotFoundException();
      parentId = parent.parentId;
    }
  }

  /** SQL predicate shared by reads that must not expose hidden accounts. */
  private scope(accounts?: string) {
    return and(eq(account.isHidden, false), accounts ? inArray(account.id, accounts.split(',')) : undefined);
  }

  /** List visible account metadata in stable display order. */
  list(accounts?: string) {
    return this.db
      .select()
      .from(account)
      .where(this.scope(accounts))
      .orderBy(asc(account.sortOrder), asc(account.name))
      .all();
  }

  /** Group depots and cash accounts, nesting selected reference accounts without double-counting. */
  tree(accounts?: string) {
    const rows = this.db
      .select({ account, institution })
      .from(account)
      .innerJoin(institution, eq(account.institutionId, institution.id))
      .where(this.scope(accounts))
      .orderBy(asc(account.sortOrder), asc(account.name))
      .all();
    const views = rows.map(({ account: item, institution: provider }) => ({
      id: item.id,
      name: item.name,
      institution: provider.name,
      logoKey: provider.logoKey,
      type: item.type,
      parent: item.parentAccountId,
      valueCents:
        item.type === 'depot'
          ? (this.db
              .select({ value: netWorthSnapshot.valueCents })
              .from(netWorthSnapshot)
              .where(eq(netWorthSnapshot.accountId, item.id))
              .orderBy(desc(netWorthSnapshot.date))
              .get()?.value ?? 0)
          : item.balanceCents,
    }));
    const depots = views.filter((item) => item.type === 'depot');
    const children = views.filter(
      (item) => item.type === 'reference' && depots.some((parent) => parent.id === item.parent),
    );
    const cash = views.filter((item) => item.type !== 'depot' && !children.includes(item));
    return {
      groups: [
        {
          type: 'depots' as const,
          totalCents: sumCents([...depots, ...children].map((item) => item.valueCents)),
          items: depots.map((item) => ({ ...item, children: children.filter((child) => child.parent === item.id) })),
        },
        { type: 'accounts' as const, totalCents: sumCents(cash.map((item) => item.valueCents)), items: cash },
      ],
    };
  }

  /** Count unreviewed, uncategorized bookings across the chosen visible accounts. */
  unreviewed(accounts?: string): { count: number } {
    return (
      this.db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(transaction)
        .innerJoin(account, eq(transaction.accountId, account.id))
        .where(and(this.scope(accounts), eq(transaction.reviewStatus, 'unreviewed'), isNull(transaction.categoryId)))
        .get() ?? { count: 0 }
    );
  }
}
