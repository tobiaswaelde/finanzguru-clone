import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { manualTransactionSchema } from '@finance/shared';
import { and, eq } from 'drizzle-orm';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { account, category, instrument, transaction } from '../../database/schema.js';
import { fingerprint } from '../../domain/dedupe.js';
import { financeDecimal, sumCents } from '../../domain/money.js';
import { RecomputeService } from '../import/recompute.service.js';

/** Creates explicitly entered owner bookings without the upload path. */
@Injectable()
export class ManualTransactionService {
  constructor(
    @Inject(DB) private readonly db: FinanceDatabase,
    @Inject(RecomputeService) private readonly recompute: RecomputeService,
  ) {}

  /** Validate references and update the booking, balance, and snapshots in one transaction. */
  create(input: ReturnType<typeof manualTransactionSchema.parse>) {
    const today = new Date().toISOString().slice(0, 10);
    if (input.bookingDate > today) throw new BadRequestException();
    const trade = input.type === 'buy' || input.type === 'sell';
    const split = input.type === 'split';
    if ((trade || split || input.type === 'dividend') && !input.instrumentId) throw new BadRequestException();
    if ((trade || split) && (!input.quantity || !new financeDecimal(input.quantity).gt(0)))
      throw new BadRequestException();
    if (trade && (!input.unitPrice || !new financeDecimal(input.unitPrice).gt(0))) throw new BadRequestException();
    return this.db.transaction((tx) => {
      const selected = tx
        .select()
        .from(account)
        .where(and(eq(account.id, input.accountId), eq(account.isHidden, false)))
        .get();
      if (!selected) throw new NotFoundException();
      if ((trade || split) && selected.type !== 'depot') throw new BadRequestException();
      if (input.instrumentId && !tx.select().from(instrument).where(eq(instrument.id, input.instrumentId)).get())
        throw new NotFoundException();
      if (input.categoryId && !tx.select().from(category).where(eq(category.id, input.categoryId)).get())
        throw new NotFoundException();
      let index = 0;
      let key = fingerprint(input, index);
      while (tx.select({ id: transaction.id }).from(transaction).where(eq(transaction.fingerprint, key)).get())
        key = fingerprint(input, ++index);
      const row = tx
        .insert(transaction)
        .values({
          ...input,
          fingerprint: key,
          source: 'manual',
          categorySource: input.categoryId ? 'manual' : null,
          reviewStatus: input.categoryId ? 'reviewed' : 'unreviewed',
        })
        .returning()
        .get();
      if (selected.type !== 'depot')
        tx.update(account)
          .set({ balanceCents: sumCents([selected.balanceCents, input.amountCents]) })
          .where(eq(account.id, selected.id))
          .run();
      try {
        this.recompute.rebuild(tx, [selected.id], input.bookingDate, today);
      } catch (error) {
        if (error instanceof RangeError) throw new BadRequestException();
        throw error;
      }
      return row;
    });
  }
}
