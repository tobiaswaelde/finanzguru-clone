import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import { dashboardLayoutSchema, dashboardWidgetKeys } from '@finance/shared';
import { asc } from 'drizzle-orm';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { dashboardLayout } from '../../database/schema.js';

/** Canonical wire shape of the ordered dashboard. */
class LayoutDto extends createZodDto(dashboardLayoutSchema) {}

/** Reads and replaces the single owner's dashboard preferences. */
@Controller('dashboard/layout')
export class LayoutController {
  constructor(@Inject(DB) private readonly db: FinanceDatabase) {}

  /** Return stored layout or the complete default order before customization. */
  @Get()
  @ZodResponse({ type: LayoutDto })
  get(): LayoutDto {
    const existing = this.db.select().from(dashboardLayout).orderBy(asc(dashboardLayout.position)).all();
    return existing.length
      ? existing
      : dashboardWidgetKeys.map((widgetKey, position) => ({ widgetKey, position, visible: true }));
  }

  /** Replace visibility and position atomically, then return the persisted order. */
  @Put()
  @ZodResponse({ type: LayoutDto })
  replace(@Body() entries: LayoutDto): LayoutDto {
    this.db.transaction((tx) => {
      tx.delete(dashboardLayout).run();
      tx.insert(dashboardLayout).values(entries).run();
    });
    return this.get();
  }
}
