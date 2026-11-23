import { Controller, Get, Inject, Query } from '@nestjs/common';
import { accountFilterQuerySchema, accountsListSchema, accountsTreeSchema } from '@finance/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { AccountsService } from './accounts.service.js';

/** Account filter accepted by owner-connected reads. */
class AccountsQueryDto extends createZodDto(accountFilterQuerySchema) {}
class AccountListDto extends createZodDto(accountsListSchema) {}
class AccountsTreeDto extends createZodDto(accountsTreeSchema) {}

/** Exposes account metadata and grouped balances. */
@Controller('accounts')
export class AccountsController {
  constructor(@Inject(AccountsService) private readonly accounts: AccountsService) {}

  /** Return the selected visible accounts. */
  @Get()
  @ZodResponse({ type: AccountListDto })
  list(@Query() query: AccountsQueryDto): AccountListDto {
    return this.accounts.list(query.accounts);
  }

  /** Return the grouped accounts and their subtotals. */
  @Get('tree')
  @ZodResponse({ type: AccountsTreeDto })
  tree(@Query() query: AccountsQueryDto): AccountsTreeDto {
    return this.accounts.tree(query.accounts);
  }
}
