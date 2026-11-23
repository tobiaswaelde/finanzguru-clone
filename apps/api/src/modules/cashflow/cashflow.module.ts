import { Module } from '@nestjs/common';
import { CashflowController } from './cashflow.controller.js';
import { CashflowService } from './cashflow.service.js';

/** Registers cash flow aggregation endpoints. */
@Module({ controllers: [CashflowController], providers: [CashflowService] })
export class CashflowModule {}
