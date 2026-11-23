import { Module } from '@nestjs/common';
import { BootstrapHealthController } from './bootstrap-health.controller.js';
import { DrizzleModule } from './database/drizzle.module.js';

@Module({ imports: [DrizzleModule], controllers: [BootstrapHealthController] })
export class AppModule {}
