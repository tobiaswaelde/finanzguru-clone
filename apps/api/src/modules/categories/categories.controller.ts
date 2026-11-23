import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import {
  categoryInputSchema,
  categorySchema,
  categoryTreeSchema,
  ruleInputSchema,
  rulePatchSchema,
  ruleSchema,
} from '@finance/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { CategoriesService } from './categories.service.js';

class CategoryInputDto extends createZodDto(categoryInputSchema) {}
class CategoryPatchDto extends createZodDto(categoryInputSchema.partial()) {}
class CategoryDto extends createZodDto(categorySchema) {}
class CategoryTreeDto extends createZodDto(categoryTreeSchema) {}
class RuleInputDto extends createZodDto(ruleInputSchema) {}
class RulePatchDto extends createZodDto(rulePatchSchema) {}
class RuleDto extends createZodDto(ruleSchema) {}
class RuleListDto extends createZodDto(z.array(ruleSchema)) {}
class ApplyDto extends createZodDto(z.object({ updated: z.int().nonnegative() })) {}

/** Owner-managed categories and automation rules. */
@Controller()
export class CategoriesController {
  constructor(@Inject(CategoriesService) private readonly service: CategoriesService) {}

  /** List categories with children. */
  @Get('categories')
  @ZodResponse({ type: CategoryTreeDto })
  categories(): CategoryTreeDto {
    return this.service.categories();
  }
  /** Create a new category. */
  @Post('categories')
  @ZodResponse({ type: CategoryDto, status: 201 })
  addCategory(@Body() body: CategoryInputDto): CategoryDto {
    return this.service.createCategory(body);
  }
  /** Update a category. */
  @Patch('categories/:id')
  @ZodResponse({ type: CategoryDto })
  patchCategory(@Param('id') id: string, @Body() body: CategoryPatchDto): CategoryDto {
    return this.service.patchCategory(id, body);
  }
  /** Delete a non-default leaf. */
  @Delete('categories/:id')
  @HttpCode(204)
  removeCategory(@Param('id') id: string): void {
    this.service.removeCategory(id);
  }

  /** List rules in priority order. */
  @Get('rules')
  @ZodResponse({ type: RuleListDto })
  rules(): RuleListDto {
    return this.service.rules();
  }
  /** Create one rule. */
  @Post('rules')
  @ZodResponse({ type: RuleDto, status: 201 })
  addRule(@Body() body: RuleInputDto): RuleDto {
    return this.service.createRule(body);
  }
  /** Update one rule. */
  @Patch('rules/:id')
  @ZodResponse({ type: RuleDto })
  patchRule(@Param('id') id: string, @Body() body: RulePatchDto): RuleDto {
    return this.service.patchRule(id, body);
  }
  /** Delete one rule. */
  @Delete('rules/:id')
  @HttpCode(204)
  removeRule(@Param('id') id: string): void {
    this.service.removeRule(id);
  }
  /** Rerun rules for unreviewed data. */
  @Post('rules/apply')
  @HttpCode(200)
  @ZodResponse({ type: ApplyDto })
  apply(): ApplyDto {
    return this.service.apply();
  }
}
