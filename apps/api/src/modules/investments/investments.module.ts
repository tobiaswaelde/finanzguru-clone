import { Module } from '@nestjs/common';
import { OverviewModule } from '../overview/overview.module.js';
import { InvestmentsController } from './investments.controller.js';
import { InvestmentsService } from './investments.service.js';

/** Registers investment views backed by the same ledger as the overview. */
@Module({ imports: [OverviewModule], controllers: [InvestmentsController], providers: [InvestmentsService] })
export class InvestmentsModule {}
