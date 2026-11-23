import { Controller, Get, Inject, Query } from '@nestjs/common';
import {
  accountFilterQuerySchema,
  investmentClassesSchema,
  investmentPerformanceQuerySchema,
  investmentPerformanceSchema,
  investmentPositionQuerySchema,
  investmentPositionsSchema,
} from '@finance/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { InvestmentsService } from './investments.service.js';

class PositionsQueryDto extends createZodDto(investmentPositionQuerySchema) {}
class PositionsDto extends createZodDto(investmentPositionsSchema) {}
class PerformanceQueryDto extends createZodDto(investmentPerformanceQuerySchema) {}
class PerformanceDto extends createZodDto(investmentPerformanceSchema) {}
class AssetClassQueryDto extends createZodDto(accountFilterQuerySchema) {}
class AssetClassesDto extends createZodDto(investmentClassesSchema) {}

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
}
