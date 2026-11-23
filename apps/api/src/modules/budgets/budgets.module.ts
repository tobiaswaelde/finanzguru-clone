import { Module } from '@nestjs/common';
import { BudgetsController } from './budgets.controller.js';
import { BudgetsService } from './budgets.service.js';

/** Registers the standalone budget management endpoints. */
@Module({ controllers: [BudgetsController], providers: [BudgetsService] })
export class BudgetsModule {}
