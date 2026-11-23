import { Controller, Get, Inject, Query } from '@nestjs/common';
import { accountFilterQuerySchema } from '@finance/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { AccountsService } from '../accounts/accounts.service.js';

class UnreviewedCountDto extends createZodDto(z.object({ count: z.int().nonnegative() })) {}
class ReviewCountQueryDto extends createZodDto(accountFilterQuerySchema) {}

/** Exposes the owner's transaction review status. */
@Controller('transactions')
export class TransactionsController {
  constructor(@Inject(AccountsService) private readonly accounts: AccountsService) {}

  /** Count scoped bookings requiring review. */
  @Get('unreviewed/count')
  @ZodResponse({ type: UnreviewedCountDto })
  unreviewed(@Query() query: ReviewCountQueryDto): UnreviewedCountDto {
    return this.accounts.unreviewed(query.accounts);
  }
}
