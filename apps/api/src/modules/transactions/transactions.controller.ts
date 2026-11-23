import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { accountFilterQuerySchema, manualTransactionSchema, transactionSchema } from '@finance/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { AccountsService } from '../accounts/accounts.service.js';
import { ManualTransactionService } from './manual-transaction.service.js';

class UnreviewedCountDto extends createZodDto(z.object({ count: z.int().nonnegative() })) {}
class ReviewCountQueryDto extends createZodDto(accountFilterQuerySchema) {}
class ManualTransactionDto extends createZodDto(manualTransactionSchema) {}
class TransactionDto extends createZodDto(transactionSchema) {}

/** Exposes the owner's transaction review status. */
@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(AccountsService) private readonly accounts: AccountsService,
    @Inject(ManualTransactionService) private readonly manual: ManualTransactionService,
  ) {}

  /** Count scoped bookings requiring review. */
  @Get('unreviewed/count')
  @ZodResponse({ type: UnreviewedCountDto })
  unreviewed(@Query() query: ReviewCountQueryDto): UnreviewedCountDto {
    return this.accounts.unreviewed(query.accounts);
  }

  /** Record an owner-entered transaction. */
  @Post()
  @ZodResponse({ type: TransactionDto, status: 201 })
  create(@Body() body: ManualTransactionDto): TransactionDto {
    return this.manual.create(body);
  }
}
