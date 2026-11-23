import { Controller, Get, Inject, Query } from '@nestjs/common';
import {
  allocationQuerySchema,
  allocationSchema,
  holdingQuerySchema,
  kpisSchema,
  netWorthQuerySchema,
  netWorthSchema,
  periodQuerySchema,
  topFlopSchema,
} from '@finance/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { OverviewMetricsService } from './overview-metrics.service.js';
import { OverviewService } from './overview.service.js';

/** Net-worth filters accepted by the overview endpoint. */
class NetWorthQueryDto extends createZodDto(netWorthQuerySchema) {}
/** Net-worth wire response. */
class NetWorthDto extends createZodDto(netWorthSchema) {}
/** Allocation filters and wire shape. */
class AllocationQueryDto extends createZodDto(allocationQuerySchema) {}
class AllocationDto extends createZodDto(allocationSchema) {}
/** Period filters for overview metrics. */
class PeriodQueryDto extends createZodDto(periodQuerySchema) {}
class KpisDto extends createZodDto(kpisSchema) {}
/** Holding filters and wire shape. */
class HoldingQueryDto extends createZodDto(holdingQuerySchema) {}
class TopFlopDto extends createZodDto(topFlopSchema) {}

/** Owner-only portfolio overview. */
@Controller('overview')
export class OverviewController {
  constructor(
    @Inject(OverviewService) private readonly overview: OverviewService,
    @Inject(OverviewMetricsService) private readonly metrics: OverviewMetricsService,
  ) {}

  /** Return the bounded daily series and selected-period totals. */
  @Get('net-worth')
  @ZodResponse({ type: NetWorthDto })
  netWorth(@Query() query: NetWorthQueryDto): NetWorthDto {
    return this.overview.netWorth(query);
  }

  /** Return current allocation by asset class. */
  @Get('allocation')
  @ZodResponse({ type: AllocationDto })
  allocation(@Query() query: AllocationQueryDto): AllocationDto {
    return this.metrics.allocation(query.accounts);
  }

  /** Return investment performance and income over the requested period. */
  @Get('kpis')
  @ZodResponse({ type: KpisDto })
  kpis(@Query() query: PeriodQueryDto): KpisDto {
    return this.metrics.kpis(query);
  }

  /** Return the best- and worst-performing open holdings. */
  @Get('holdings/top-flop')
  @ZodResponse({ type: TopFlopDto })
  holdings(@Query() query: HoldingQueryDto): TopFlopDto {
    return this.metrics.holdings(query);
  }
}
