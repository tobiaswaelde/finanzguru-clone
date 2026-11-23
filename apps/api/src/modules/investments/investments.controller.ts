import { Controller, Get, Inject, Param, Query, Res } from '@nestjs/common';
import {
  accountFilterQuerySchema,
  investmentClassesSchema,
  investmentDetailSchema,
  investmentExportQuerySchema,
  investmentPerformanceQuerySchema,
  investmentPerformanceSchema,
  investmentPositionQuerySchema,
  investmentPositionsSchema,
  investmentTransactionsQuerySchema,
  investmentTransactionsSchema,
  periodQuerySchema,
} from '@finance/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import type { FastifyReply } from 'fastify';
import { InvestmentsService } from './investments.service.js';

class PositionsQueryDto extends createZodDto(investmentPositionQuerySchema) {}
class PositionsDto extends createZodDto(investmentPositionsSchema) {}
class PerformanceQueryDto extends createZodDto(investmentPerformanceQuerySchema) {}
class PerformanceDto extends createZodDto(investmentPerformanceSchema) {}
class AssetClassQueryDto extends createZodDto(accountFilterQuerySchema) {}
class AssetClassesDto extends createZodDto(investmentClassesSchema) {}
class ExportQueryDto extends createZodDto(investmentExportQuerySchema) {}
class DetailQueryDto extends createZodDto(periodQuerySchema) {}
class DetailDto extends createZodDto(investmentDetailSchema) {}
class TransactionsQueryDto extends createZodDto(investmentTransactionsQuerySchema) {}
class TransactionsDto extends createZodDto(investmentTransactionsSchema) {}

/** Owner-only investment analytics. */
@Controller('investments')
export class InvestmentsController {
  constructor(@Inject(InvestmentsService) private readonly service: InvestmentsService) {}

  /** Read the daily value and invested capital for selected depots. */
  @Get('performance')
  @ZodResponse({ type: PerformanceDto })
  performance(@Query() query: PerformanceQueryDto): PerformanceDto {
    return this.service.performance(query);
  }

  /** List portfolio positions as open or fully sold. */
  @Get('positions')
  @ZodResponse({ type: PositionsDto })
  positions(@Query() query: PositionsQueryDto): PositionsDto {
    return this.service.positions(query);
  }

  /** Group current positions by asset class. */
  @Get('asset-classes')
  @ZodResponse({ type: AssetClassesDto })
  assetClasses(@Query() query: AssetClassQueryDto): AssetClassesDto {
    return this.service.classes(query.accounts);
  }

  /** Download the selected position columns as a UTF-8 CSV. */
  @Get('positions.csv')
  exportCsv(@Query() query: ExportQueryDto, @Res({ passthrough: true }) reply: FastifyReply): string {
    const csv = this.service.csv(query);
    void reply.type('text/csv; charset=utf-8').header('Content-Disposition', 'attachment; filename="positions.csv"');
    return csv;
  }

  /** Return position and price history for one instrument. */
  @Get('instruments/:id')
  @ZodResponse({ type: DetailDto })
  detail(@Param('id') id: string, @Query() query: DetailQueryDto): DetailDto {
    return this.service.detail(id, query);
  }

  /** List investment transactions in the selected account scope. */
  @Get('transactions')
  @ZodResponse({ type: TransactionsDto })
  transactions(@Query() query: TransactionsQueryDto): TransactionsDto {
    return this.service.transactions(query);
  }
}
