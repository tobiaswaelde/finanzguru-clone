import { Controller, Get, Inject, Query } from '@nestjs/common';
import {
  cashflowCategoriesSchema,
  cashflowQuerySchema,
  cashflowSankeySchema,
  cashflowSummarySchema,
} from '@finance/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { CashflowService } from './cashflow.service.js';

class SummaryQueryDto extends createZodDto(cashflowQuerySchema) {}
class CategoriesQueryDto extends createZodDto(
  cashflowQuerySchema.extend({ kind: z.enum(['income', 'expense']).default('expense') }),
) {}
class SankeyQueryDto extends createZodDto(
  cashflowQuerySchema.extend({ unit: z.enum(['eur', 'pct']).default('eur') }),
) {}
class SummaryDto extends createZodDto(cashflowSummarySchema) {}
class CategoriesDto extends createZodDto(cashflowCategoriesSchema) {}
class SankeyDto extends createZodDto(cashflowSankeySchema) {}

/** Owner-only views of budget flows and category totals. */
@Controller('cashflow')
export class CashflowController {
  constructor(@Inject(CashflowService) private readonly cashflow: CashflowService) {}

  /** Return summary and historical bars. */
  @Get('summary')
  @ZodResponse({ type: SummaryDto })
  summary(@Query() query: SummaryQueryDto): SummaryDto {
    return this.cashflow.summary(query);
  }

  /** Return income or expense groups. */
  @Get('categories')
  @ZodResponse({ type: CategoriesDto })
  categories(@Query() query: CategoriesQueryDto): CategoriesDto {
    return this.cashflow.categories(query, query.kind);
  }

  /** Return flow nodes and links in cents; clients can format ratios. */
  @Get('sankey')
  @ZodResponse({ type: SankeyDto })
  sankey(@Query() query: SankeyQueryDto): SankeyDto {
    return this.cashflow.sankey(query);
  }
}
