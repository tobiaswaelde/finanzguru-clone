import { Body, Controller, Get, Inject, Patch, Req, UnauthorizedException } from '@nestjs/common';
import { ownerSettingsPatchSchema, ownerSettingsSchema } from '@finance/shared';
import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { owner } from '../../database/schema.js';
import './session.types.js';

const fields = { displayName: owner.displayName, inflationRate: owner.inflationRate };
class SettingsDto extends createZodDto(ownerSettingsSchema) {}
class SettingsPatchDto extends createZodDto(ownerSettingsPatchSchema) {}

/** Read and change the authenticated owner's public preferences. */
@Controller('settings')
export class SettingsController {
  constructor(@Inject(DB) private readonly db: FinanceDatabase) {}

  /** Return preferences without credentials. */
  @Get()
  @ZodResponse({ type: SettingsDto })
  get(@Req() request: FastifyRequest): SettingsDto {
    const id = request.session.get('ownerId');
    const result = id && this.db.select(fields).from(owner).where(eq(owner.id, id)).get();
    if (!result) throw new UnauthorizedException();
    return result;
  }

  /** Update only the specified preferences. */
  @Patch()
  @ZodResponse({ type: SettingsDto })
  patch(@Req() request: FastifyRequest, @Body() input: SettingsPatchDto): SettingsDto {
    const id = request.session.get('ownerId');
    if (!id) throw new UnauthorizedException();
    if (!Object.keys(input).length) return this.get(request);
    const result = this.db.update(owner).set(input).where(eq(owner.id, id)).returning(fields).get();
    if (!result) throw new UnauthorizedException();
    return result;
  }
}
