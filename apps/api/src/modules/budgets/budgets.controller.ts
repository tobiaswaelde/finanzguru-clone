import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { accountFilterQuerySchema, budgetInputSchema, budgetSchema, budgetsSchema } from '@finance/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { BudgetsService } from './budgets.service.js';

class BudgetQueryDto extends createZodDto(accountFilterQuerySchema) {}
class BudgetInputDto extends createZodDto(budgetInputSchema) {}
class BudgetChangeDto extends createZodDto(budgetInputSchema.partial()) {}
class BudgetDto extends createZodDto(budgetSchema) {}
class BudgetsDto extends createZodDto(budgetsSchema) {}

/** Owner-only spending limits. */
@Controller('budgets')
export class BudgetsController {
  constructor(@Inject(BudgetsService) private readonly service: BudgetsService) {}

  /** Return monthly totals optionally scoped to selected accounts. */
  @Get()
  @ZodResponse({ type: BudgetsDto })
  list(@Query() query: BudgetQueryDto): BudgetsDto {
    return this.service.list(query.accounts);
  }
  /** Add a budget for one expense category. */
  @Post()
  @ZodResponse({ type: BudgetDto, status: 201 })
  create(@Body() body: BudgetInputDto): BudgetDto {
    return this.service.create(body);
  }
  /** Change a budget without modifying past transactions. */
  @Patch(':id')
  @ZodResponse({ type: BudgetDto })
  patch(@Param('id') id: string, @Body() body: BudgetChangeDto): BudgetDto {
    return this.service.patch(id, body);
  }
  /** Remove an existing budget. */
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): void {
    this.service.remove(id);
  }
}
