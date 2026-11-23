import { Module } from '@nestjs/common';
import { BootstrapHealthController } from './bootstrap-health.controller.js';

@Module({ controllers: [BootstrapHealthController] })
export class AppModule {}
