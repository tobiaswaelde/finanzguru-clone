import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { account, institution, netWorthSnapshot, transaction } from '../../database/schema.js';
import { sumCents } from '../../domain/money.js';

/** Reads owner-visible accounts and account-scoped transaction counts. */
@Injectable()
export class AccountsService {
  constructor(@Inject(DB) private readonly db: FinanceDatabase) {}

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
