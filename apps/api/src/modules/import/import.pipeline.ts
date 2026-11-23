import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { dateSchema, isValidIban, isValidIsin, type SyncBatch } from '@finance/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DB, type FinanceDatabase, type FinanceTransaction } from '../../database/drizzle.module.js';
import {
  account,
  categorizationRule,
  dataSource,
  importJob,
  institution,
  instrument,
  positionLot,
  price,
  sourceAccount,
  transaction,
} from '../../database/schema.js';
import { createCategorizer } from '../../domain/categorize.js';
import { createFingerprinter, isDuplicate } from '../../domain/dedupe.js';
import { financeDecimal, sumCents } from '../../domain/money.js';
import { RecomputeService } from './recompute.service.js';

/** Explicit target overrides for uploaded files; source-native refs are used for pulls. */
export interface ImportTargets {
  accountId?: string;
}

/** Commits one normalized provider batch, keeping its status and errors separate from failed writes. */
@Injectable()
export class ImportPipeline {
  constructor(
    @Inject(DB) private readonly db: FinanceDatabase,
    @Inject(RecomputeService) private readonly recompute: RecomputeService,
  ) {}

  /** Run an import once; return the terminal state while keeping all data writes atomic. */
  run(jobId: string, batch: SyncBatch, targets: ImportTargets = {}) {
    const job = this.db.select().from(importJob).where(eq(importJob.id, jobId)).get();
    if (!job) throw new NotFoundException();
    if (job.status !== 'running') throw new ConflictException();
    try {
      return this.db.transaction((tx) => this.persist(tx, job, batch, targets));
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      return this.db
        .update(importJob)
        .set({
          status: 'failed',
          imported: 0,
          skipped: 0,
          failed: batch.transactions.length + batch.rowErrors.length,
          errors: [...batch.rowErrors.slice(0, 499), { reason: 'import_rolled_back' }],
          finishedAt: new Date().toISOString(),
        })
        .where(eq(importJob.id, job.id))
        .returning()
        .get();
    }
  }

  /** Upsert mapped accounts and maintain persistent provider-to-local identities. */
  private accountIds(
    tx: FinanceTransaction,
    job: typeof importJob.$inferSelect,
    batch: SyncBatch,
    targets: ImportTargets,
  ) {
    const refs = new Map<string, string>();
    const balances = new Map<string, number>();
    if (targets.accountId) {
      const target = tx
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.id, targets.accountId), eq(account.isHidden, false)))
        .get();
      if (!target) throw new NotFoundException();
    }
    for (const input of batch.accounts) {
      if (targets.accountId) {
        refs.set(input.externalRef, targets.accountId);
        continue;
      }
      tx.insert(institution).values({ name: input.institutionName }).onConflictDoNothing().run();
      const provider = tx
        .select({ id: institution.id })
        .from(institution)
        .where(eq(institution.name, input.institutionName))
        .get();
      if (!provider) throw new Error('Missing import institution');
      const linked = tx
        .select()
        .from(sourceAccount)
        .where(and(eq(sourceAccount.sourceId, job.sourceId), eq(sourceAccount.externalRef, input.externalRef)))
        .get();
      const normalizedIban = input.iban?.replace(/\s/gu, '').toUpperCase();
      const iban = normalizedIban && isValidIban(normalizedIban) ? normalizedIban : undefined;
      const existing =
        linked?.accountId ??
        (iban ? tx.select({ id: account.id }).from(account).where(eq(account.iban, iban)).get()?.id : undefined);
      const id =
        existing ??
        tx
          .insert(account)
          .values({
            institutionId: provider.id,
            name: input.name,
            type: input.type,
            iban,
            sourceId: job.sourceId,
          })
          .returning({ id: account.id })
          .get().id;
      if (!linked)
        tx.insert(sourceAccount)
          .values({ sourceId: job.sourceId, externalRef: input.externalRef, accountId: id })
          .run();
      refs.set(input.externalRef, id);
      if (input.balanceCents !== undefined) balances.set(id, sumCents([input.balanceCents]));
    }
    if (!targets.accountId) {
      for (const input of batch.accounts) {
        const child = refs.get(input.externalRef);
        const parent = input.parentExternalRef ? refs.get(input.parentExternalRef) : undefined;
        if (child && parent && child !== parent)
          tx.update(account).set({ parentAccountId: parent }).where(eq(account.id, child)).run();
      }
    }
    return { refs, balances };
  }

  /** Validate, normalize, deduplicate, categorize, and recompute a source batch. */
  private persist(
    tx: FinanceTransaction,
    job: typeof importJob.$inferSelect,
    batch: SyncBatch,
    targets: ImportTargets,
  ) {
    const provider = tx.select().from(dataSource).where(eq(dataSource.id, job.sourceId)).get();
    if (!provider || provider.kind === 'sparkasse_fints') throw new Error('Unsupported import source');
    const source = provider.kind;
    const timestamp = new Date().toISOString();
    const today = timestamp.slice(0, 10);
    const { refs, balances } = this.accountIds(tx, job, batch, targets);
    const errors = batch.rowErrors.slice(0, 500);
    let skipped = batch.rowErrors.filter((error) => error.reason === 'not_executed').length;
    let failed = batch.rowErrors.length - skipped;
    /** Record a bounded row error without losing the unbounded failure count. */
    function reject(reason: string) {
      failed++;
      if (errors.length < 500) errors.push({ reason });
    }
    const securityIds = new Map<string, string>();
    /** Resolve a security ID by ISIN, avoiding repeated lookups within a batch. */
    function security(isin: string): string | undefined {
      const existing =
        securityIds.get(isin) ??
        tx.select({ id: instrument.id }).from(instrument).where(eq(instrument.isin, isin)).get()?.id;
      if (existing) securityIds.set(isin, existing);
      return existing;
    }
    for (const input of batch.instruments) {
      if (!isValidIsin(input.isin)) continue;
      tx.insert(instrument).values(input).onConflictDoNothing({ target: instrument.isin }).run();
    }
    const affected = new Map<string, string>();
    /** Remember the earliest changed date for a specific local account. */
    function touch(id: string, from: string) {
      const previous = affected.get(id);
      if (!previous || previous > from) affected.set(id, from);
    }
    for (const input of batch.prices) {
      const instrumentId = security(input.isin);
      if (
        !instrumentId ||
        !dateSchema.safeParse(input.date).success ||
        !Number.isFinite(Number(input.close)) ||
        Number(input.close) <= 0
      )
        continue;
      const row = {
        instrumentId,
        date: input.date,
        close: input.close,
        source: source === 'csv' ? ('csv' as const) : ('scalable' as const),
      };
      const changed = tx
        .insert(price)
        .values(row)
        .onConflictDoUpdate({
          target: [price.instrumentId, price.date],
          set: { close: input.close, source: row.source },
          setWhere: sql`${price.close} <> ${input.close}`,
        })
        .run();
      if (changed.changes) {
        for (const lot of tx
          .selectDistinct({ id: positionLot.accountId })
          .from(positionLot)
          .where(eq(positionLot.instrumentId, instrumentId))
          .all())
          touch(lot.id, input.date);
      }
    }
    const categorize = createCategorizer(
      tx.select().from(categorizationRule).all(),
      tx
        .select({ iban: account.iban })
        .from(account)
        .all()
        .flatMap((row) => (row.iban ? [row.iban] : [])),
    );
    const nextFingerprint = createFingerprinter();
    let imported = 0;
    const cash = new Map<string, number>();
    const accountTypes = new Map(
      tx
        .select({ id: account.id, type: account.type })
        .from(account)
        .all()
        .map((row) => [row.id, row.type]),
    );
    for (const row of batch.transactions) {
      const accountId =
        targets.accountId ??
        refs.get(row.accountExternalRef) ??
        tx
          .select({ id: sourceAccount.accountId })
          .from(sourceAccount)
          .where(and(eq(sourceAccount.sourceId, job.sourceId), eq(sourceAccount.externalRef, row.accountExternalRef)))
          .get()?.id;
      if (!accountId) {
        reject('missing_account');
        continue;
      }
      if (
        !dateSchema.safeParse(row.bookingDate).success ||
        row.bookingDate > today ||
        !Number.isSafeInteger(row.amountCents)
      ) {
        reject('invalid_booking');
        continue;
      }
      const instrumentId = row.isin ? security(row.isin) : undefined;
      const trade = row.type === 'buy' || row.type === 'sell';
      const split = row.type === 'split';
      if ((trade || split || row.type === 'dividend') && !instrumentId) {
        reject('missing_instrument');
        continue;
      }
      if ((trade || split) && accountTypes.get(accountId) !== 'depot') {
        reject('requires_depot');
        continue;
      }
      if ((trade || split) && (!(Number(row.quantity) > 0) || (trade && !(Number(row.unitPrice) > 0)))) {
        reject('invalid_trade');
        continue;
      }
      const fingerprint = nextFingerprint({ ...row, accountId });
      if (
        isDuplicate(
          { source, sourceRef: row.sourceRef, fingerprint },
          {
            bySourceRef: (sourceKind, reference) =>
              !!tx
                .select({ id: transaction.id })
                .from(transaction)
                .where(and(eq(transaction.source, sourceKind as typeof source), eq(transaction.sourceRef, reference)))
                .get(),
            byFingerprint: (key) =>
              !!tx.select({ id: transaction.id }).from(transaction).where(eq(transaction.fingerprint, key)).get(),
          },
        )
      ) {
        skipped++;
        continue;
      }
      const categorized = categorize(row);
      tx.insert(transaction)
        .values({
          ...row,
          accountId,
          instrumentId,
          importJobId: job.id,
          fingerprint,
          source,
          type: categorized.type,
          categoryId: categorized.categoryId,
          categorySource: categorized.categorySource,
        })
        .run();
      imported++;
      if (accountTypes.get(accountId) !== 'depot')
        cash.set(accountId, sumCents([cash.get(accountId) ?? 0, row.amountCents]));
      touch(accountId, row.bookingDate);
    }
    for (const [id, value] of balances) {
      tx.update(account)
        .set({ balanceCents: value, lastSyncedAt: timestamp })
        .where(and(eq(account.id, id), sql`${account.balanceCents} <> ${value}`))
        .run();
      if (!affected.has(id)) touch(id, today);
    }
    for (const [id, delta] of cash) {
      if (!balances.has(id))
        tx.update(account)
          .set({ balanceCents: sql`${account.balanceCents} + ${delta}` })
          .where(eq(account.id, id))
          .run();
    }
    for (const [id, from] of affected) if (from <= today) this.recompute.rebuild(tx, [id], from, today);
    for (const item of batch.positionsSnapshot ?? []) {
      const id = refs.get(item.accountExternalRef);
      const instrumentId = security(item.isin);
      if (!id || !instrumentId) continue;
      const lots = tx
        .select()
        .from(positionLot)
        .where(and(eq(positionLot.instrumentId, instrumentId), inArray(positionLot.accountId, [id])))
        .all();
      const actual = lots.reduce((sum, lot) => sum.plus(lot.quantityOpen), new financeDecimal(0));
      if (!actual.eq(item.quantity) && errors.length < 500) errors.push({ reason: 'positions_mismatch' });
    }
    return tx
      .update(importJob)
      .set({
        status: failed > 0 ? (imported || skipped ? 'partial' : 'failed') : 'succeeded',
        imported,
        skipped,
        failed,
        errors,
        finishedAt: timestamp,
      })
      .where(eq(importJob.id, job.id))
      .returning()
      .get();
  }
}
