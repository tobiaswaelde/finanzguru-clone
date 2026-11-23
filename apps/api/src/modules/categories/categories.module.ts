import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';

/** Registers category and classification rule management. */
@Module({ controllers: [CategoriesController], providers: [CategoriesService] })
export class CategoriesModule {}
