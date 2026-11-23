import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import {
  insuranceContractSchema,
  insuranceContractsSchema,
  insuranceInputSchema,
  insuranceShapeSchema,
} from '@finance/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { InsuranceService } from './insurance.service.js';

class ContractDto extends createZodDto(insuranceContractSchema) {}
class ContractsDto extends createZodDto(insuranceContractsSchema) {}
class ContractInputDto extends createZodDto(insuranceInputSchema) {}
class ContractPatchDto extends createZodDto(insuranceShapeSchema.partial()) {}

/** Owner-only insurance register. */
@Controller('insurance')
export class InsuranceController {
  constructor(@Inject(InsuranceService) private readonly service: InsuranceService) {}
  /** Return the contracts and annual costs. */
  @Get()
  @ZodResponse({ type: ContractsDto })
  list(): ContractsDto {
    return this.service.list();
  }
  /** Create a contract. */
  @Post()
  @ZodResponse({ type: ContractDto, status: 201 })
  create(@Body() input: ContractInputDto): ContractDto {
    return this.service.create(input);
  }
  /** Update one contract. */
  @Patch(':id')
  @ZodResponse({ type: ContractDto })
  patch(@Param('id') id: string, @Body() input: ContractPatchDto): ContractDto {
    return this.service.patch(id, input);
  }
  /** Delete one contract. */
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): void {
    this.service.remove(id);
  }
}
