import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

/** Registers the API readiness endpoint. */
@Module({ controllers: [HealthController] })
export class HealthModule {}
