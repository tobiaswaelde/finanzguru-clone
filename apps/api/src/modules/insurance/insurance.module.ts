import { Module } from '@nestjs/common';
import { InsuranceController } from './insurance.controller.js';
import { InsuranceService } from './insurance.service.js';

/** Registers independent insurance operations. */
@Module({ controllers: [InsuranceController], providers: [InsuranceService] })
export class InsuranceModule {}
