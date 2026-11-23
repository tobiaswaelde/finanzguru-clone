import { Module } from '@nestjs/common';
import { LayoutController } from './layout.controller.js';
import { OverviewController } from './overview.controller.js';
import { OverviewService } from './overview.service.js';

/** Registers the authenticated dashboard endpoints. */
@Module({ controllers: [LayoutController, OverviewController], providers: [OverviewService] })
export class OverviewModule {}
