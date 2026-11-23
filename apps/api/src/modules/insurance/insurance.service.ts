import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { insuranceInputSchema } from '@finance/shared';
import { asc, eq } from 'drizzle-orm';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { category, insuranceContract } from '../../database/schema.js';

type ContractInput = ReturnType<typeof insuranceInputSchema.parse>;
const timesPerYear = { monthly: 12, quarterly: 4, semiannual: 2, annual: 1 };

/** Manage manually entered insurance contracts for the owner. */
@Injectable()
export class InsuranceService {
  constructor(@Inject(DB) private readonly db: FinanceDatabase) {}

  /** Derive annual premium without persisting a duplicate monetary amount. */
  private view(row: typeof insuranceContract.$inferSelect) {
    return { ...row, yearlyCostCents: row.premiumCents * timesPerYear[row.interval] };
  }

  /** List insurance contracts in a stable order. */
  list() {
    return this.db
      .select()
      .from(insuranceContract)
      .orderBy(asc(insuranceContract.provider), asc(insuranceContract.id))
      .all()
      .map((row) => this.view(row));
  }

  /** Store one validated contract. */
  create(input: ContractInput) {
    this.validateCategory(input.linkedCategoryId);
    return this.view(this.db.insert(insuranceContract).values(input).returning().get());
  }

  /** Merge a partial update and revalidate cross-field constraints. */
  patch(id: string, input: Partial<ContractInput>) {
    const previous = this.db.select().from(insuranceContract).where(eq(insuranceContract.id, id)).get();
    if (!previous) throw new NotFoundException();
    const next = insuranceInputSchema.safeParse({ ...previous, ...input });
    if (!next.success) throw new BadRequestException();
    this.validateCategory(next.data.linkedCategoryId);
    return this.view(
      this.db.update(insuranceContract).set(next.data).where(eq(insuranceContract.id, id)).returning().get(),
    );
  }

  /** Remove only the contract record. */
  remove(id: string): void {
    if (!this.db.delete(insuranceContract).where(eq(insuranceContract.id, id)).run().changes)
      throw new NotFoundException();
  }

  /** Ensure an optional linked expense category exists and can match premium bookings. */
  private validateCategory(id?: string | null): void {
    if (!id) return;
    const linked = this.db.select().from(category).where(eq(category.id, id)).get();
    if (!linked) throw new NotFoundException();
    if (linked.kind !== 'expense') throw new BadRequestException();
  }
}
