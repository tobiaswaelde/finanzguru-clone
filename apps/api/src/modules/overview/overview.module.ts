import { Module } from '@nestjs/common';
import { LayoutController } from './layout.controller.js';

/** Registers the authenticated dashboard endpoints. */
@Module({ controllers: [LayoutController] })
export class OverviewModule {}
