import { Module } from '@nestjs/common';
import { LayoutController } from './layout.controller.js';
import { OverviewMetricsService } from './overview-metrics.service.js';
import { OverviewController } from './overview.controller.js';
import { OverviewService } from './overview.service.js';

/** Registers the authenticated dashboard endpoints. */
@Module({
  controllers: [LayoutController, OverviewController],
  providers: [OverviewService, OverviewMetricsService],
  exports: [OverviewService],
})
export class OverviewModule {}
