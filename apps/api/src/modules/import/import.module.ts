import { Module } from '@nestjs/common';
import { CsvSource } from '../sources/csv/csv.source.js';
import { CsvImportService } from './csv-import.service.js';
import { ImportController } from './import.controller.js';
import { ImportPipeline } from './import.pipeline.js';
import { RecomputeService } from './recompute.service.js';

/** Registers CSV operations and the shared transactional import pipeline. */
@Module({
  controllers: [ImportController],
  providers: [CsvSource, CsvImportService, ImportPipeline, RecomputeService],
  exports: [ImportPipeline, RecomputeService, CsvSource],
})
export class ImportModule {}
