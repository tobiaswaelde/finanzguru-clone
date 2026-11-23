import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { DrizzleModule } from './database/drizzle.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BudgetsModule } from './modules/budgets/budgets.module.js';
import { CashflowModule } from './modules/cashflow/cashflow.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ImportModule } from './modules/import/import.module.js';
import { InvestmentsModule } from './modules/investments/investments.module.js';
import { OverviewModule } from './modules/overview/overview.module.js';

/** Registers infrastructure and the HTTP feature modules. */
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: false,
        redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
      },
    }),
    DrizzleModule,
    AuthModule,
    HealthModule,
    OverviewModule,
    AccountsModule,
    ImportModule,
    InvestmentsModule,
    CashflowModule,
    CategoriesModule,
    BudgetsModule,
  ],
})
export class AppModule {}
