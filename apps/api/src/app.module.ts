import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { DrizzleModule } from './database/drizzle.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
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
  ],
})
export class AppModule {}
