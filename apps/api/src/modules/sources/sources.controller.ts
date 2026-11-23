import { Controller, Get, Inject } from '@nestjs/common';
import { sourceSchema } from '@finance/shared';
import { asc } from 'drizzle-orm';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { dataSource } from '../../database/schema.js';

class SourcesDto extends createZodDto(z.array(sourceSchema)) {}

/** Public metadata for the owner's data sources, never provider credentials. */
@Controller('sources')
export class SourcesController {
  constructor(@Inject(DB) private readonly db: FinanceDatabase) {}

  /** List connection status without selecting grants or tool metadata. */
  @Get()
  @ZodResponse({ type: SourcesDto })
  list(): SourcesDto {
    const { id, kind, status, displayName, lastSyncAt, lastError } = dataSource;
    return this.db
      .select({ id, kind, status, displayName, lastSyncAt, lastError })
      .from(dataSource)
      .orderBy(asc(displayName))
      .all();
  }
}
