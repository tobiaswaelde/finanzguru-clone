import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionGuard } from './session.guard.js';
import { SettingsController } from './settings.controller.js';

/** Registers the login routes, rate limit, and global session guard. */
@Module({
  imports: [ThrottlerModule.forRoot([{ limit: 5, ttl: 60_000 }])],
  providers: [AuthService, { provide: APP_GUARD, useClass: SessionGuard }],
  controllers: [AuthController, SettingsController],
})
export class AuthModule {}
