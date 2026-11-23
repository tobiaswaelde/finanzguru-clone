import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  accountFilterQuerySchema,
  accountSchema,
  accountsListSchema,
  accountsTreeSchema,
  manualAccountSchema,
  patchAccountSchema,
} from '@finance/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { AccountsService } from './accounts.service.js';

/** Account filter accepted by owner-connected reads. */
class AccountsQueryDto extends createZodDto(accountFilterQuerySchema) {}
class AccountListDto extends createZodDto(accountsListSchema) {}
class AccountsTreeDto extends createZodDto(accountsTreeSchema) {}
class ManualAccountDto extends createZodDto(manualAccountSchema) {}
class PatchAccountDto extends createZodDto(patchAccountSchema) {}
class AccountDto extends createZodDto(accountSchema) {}
class DeleteQueryDto extends createZodDto(z.object({ force: z.enum(['true', 'false']).optional() })) {}

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

  /** Create a manual account. */
  @Post()
  @ZodResponse({ type: AccountDto, status: 201 })
  create(@Body() body: ManualAccountDto): AccountDto {
    return this.accounts.create(body);
  }

  /** Update a manual account's metadata or balance. */
  @Patch(':id')
  @ZodResponse({ type: AccountDto })
  patch(@Param('id') id: string, @Body() body: PatchAccountDto): AccountDto {
    return this.accounts.patch(id, body);
  }

  /** Delete an account, refusing to discard bookings unless explicitly forced. */
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Query() query: DeleteQueryDto): void {
    this.accounts.remove(id, query.force === 'true');
  }
}
