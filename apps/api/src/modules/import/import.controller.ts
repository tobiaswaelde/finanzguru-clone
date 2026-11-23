import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  PayloadTooLargeException,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import {
  csvConfirmSchema,
  csvPreviewSchema,
  idSchema,
  importJobSchema,
  saveCsvMappingSchema,
  savedCsvMappingSchema,
} from '@finance/shared';
import type { FastifyRequest } from 'fastify';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { CsvImportService } from './csv-import.service.js';

class PreviewDto extends createZodDto(csvPreviewSchema) {}
class ConfirmDto extends createZodDto(csvConfirmSchema) {}
class JobDto extends createZodDto(importJobSchema) {}
class SaveMappingDto extends createZodDto(saveCsvMappingSchema) {}
class MappingDto extends createZodDto(savedCsvMappingSchema) {}
class MappingsDto extends createZodDto(z.array(savedCsvMappingSchema)) {}
const uploadFields = z.object({ accountId: idSchema.optional(), mappingId: idSchema.optional() });

/** Endpoints for CSV upload, confirmation, and saved column mappings. */
@Controller()
export class ImportController {
  constructor(@Inject(CsvImportService) private readonly service: CsvImportService) {}

  /** Read one multipart CSV file and create its authenticated import preview. */
  @Post('import/csv')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        accountId: { type: 'string', format: 'uuid' },
        mappingId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ZodResponse({ type: PreviewDto, status: 201 })
  async upload(@Req() request: FastifyRequest): Promise<PreviewDto> {
    if (!request.isMultipart()) throw new BadRequestException();
    let file: Buffer | undefined;
    let filename = '';
    const fields: Record<string, unknown> = {};
    try {
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          if (part.fieldname !== 'file') throw new BadRequestException();
          file = await part.toBuffer();
          filename = part.filename;
        } else if (part.fieldname === 'accountId' || part.fieldname === 'mappingId') {
          if (Object.hasOwn(fields, part.fieldname)) throw new BadRequestException();
          fields[part.fieldname] = part.value;
        } else {
          throw new BadRequestException();
        }
      }
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && error.statusCode === 413)
        throw new PayloadTooLargeException();
      throw new BadRequestException();
    }
    const options = uploadFields.safeParse(fields);
    if (!options.success || !file?.length) throw new BadRequestException();
    return this.service.preview(file, filename, options.data);
  }

  /** Apply the preview once to its selected account. */
  @Post('import/csv/:id/confirm')
  @HttpCode(200)
  @ZodResponse({ type: JobDto })
  confirm(@Param('id') id: string, @Body() body: ConfirmDto): JobDto {
    return this.service.confirm(id, body);
  }

  /** Read a staged or completed import's current status. */
  @Get('import/jobs/:id')
  @ZodResponse({ type: JobDto })
  job(@Param('id') id: string): JobDto {
    return this.service.job(id);
  }

  /** List stored CSV mappings. */
  @Get('csv-mappings')
  @ZodResponse({ type: MappingsDto })
  list(): MappingsDto {
    return MappingsDto.schema.parse(this.service.list());
  }

  /** Store one mapping by canonical header signature. */
  @Post('csv-mappings')
  @ZodResponse({ type: MappingDto, status: 201 })
  save(@Body() body: SaveMappingDto): MappingDto {
    return savedCsvMappingSchema.parse(this.service.save(body));
  }

  /** Delete a stored mapping. */
  @Delete('csv-mappings/:id')
  @HttpCode(204)
  remove(@Param('id') id: string): void {
    this.service.remove(id);
  }
}
