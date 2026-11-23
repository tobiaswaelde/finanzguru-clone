import { Controller, Get, Inject, Query } from '@nestjs/common';
import { netWorthQuerySchema, netWorthSchema } from '@finance/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { OverviewService } from './overview.service.js';

/** Net-worth filters accepted by the overview endpoint. */
class NetWorthQueryDto extends createZodDto(netWorthQuerySchema) {}
/** Net-worth wire response. */
class NetWorthDto extends createZodDto(netWorthSchema) {}

/** Owner-only portfolio overview. */
@Controller('overview')
export class OverviewController {
  constructor(@Inject(OverviewService) private readonly overview: OverviewService) {}

  /** Return the bounded daily series and selected-period totals. */
  @Get('net-worth')
  @ZodResponse({ type: NetWorthDto })
  netWorth(@Query() query: NetWorthQueryDto): NetWorthDto {
    return this.overview.netWorth(query);
  }
}
