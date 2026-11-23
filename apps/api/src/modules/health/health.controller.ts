import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { Public } from '../../common/decorators/public.decorator.js';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';

/** Provides an unauthenticated readiness probe with no user data. */
@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: FinanceDatabase) {}

  /** Verify that SQLite can execute a query; return 503 if it cannot. */
  @Public()
  @Get()
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['status', 'db'],
      properties: { status: { type: 'string', enum: ['ok'] }, db: { type: 'string', enum: ['ok'] } },
    },
  })
  @ApiServiceUnavailableResponse()
  health(): { status: 'ok'; db: 'ok' } {
    try {
      this.db.get(sql`SELECT 1`);
      return { status: 'ok', db: 'ok' };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
