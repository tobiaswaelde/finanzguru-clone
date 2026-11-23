import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  accountFilterQuerySchema,
  investmentTransactionsSchema,
  manualTransactionSchema,
  transactionListQuerySchema,
  transactionReviewSchema,
  transactionSchema,
} from '@finance/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { AccountsService } from '../accounts/accounts.service.js';
import { ManualTransactionService } from './manual-transaction.service.js';
import { TransactionReviewService } from './transaction-review.service.js';

class UnreviewedCountDto extends createZodDto(z.object({ count: z.int().nonnegative() })) {}
class ReviewCountQueryDto extends createZodDto(accountFilterQuerySchema) {}
class ManualTransactionDto extends createZodDto(manualTransactionSchema) {}
class TransactionDto extends createZodDto(transactionSchema) {}
class TransactionListQueryDto extends createZodDto(transactionListQuerySchema) {}
class TransactionListDto extends createZodDto(investmentTransactionsSchema) {}
class TransactionReviewDto extends createZodDto(transactionReviewSchema) {}

/** Exposes the owner's transaction review status. */
@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(AccountsService) private readonly accounts: AccountsService,
    @Inject(ManualTransactionService) private readonly manual: ManualTransactionService,
    @Inject(TransactionReviewService) private readonly reviewService: TransactionReviewService,
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

  /** Read the filtered booking list. */
  @Get()
  @ZodResponse({ type: TransactionListDto })
  list(@Query() query: TransactionListQueryDto): TransactionListDto {
    return this.reviewService.list(query);
  }

  /** Categorize or confirm a specific owner-visible booking. */
  @Patch(':id')
  @ZodResponse({ type: TransactionDto })
  review(@Param('id') id: string, @Body() body: TransactionReviewDto): TransactionDto {
    return this.reviewService.review(id, body);
  }
}
