import { Inject, Module } from '@nestjs/common';
import { CsvSource } from '../sources/csv/csv.source.js';
import { SourcesController } from '../sources/sources.controller.js';
import { SourcesRegistry } from '../sources/sources.registry.js';
import { SparkasseFintsSource } from '../sources/sparkasse-fints/sparkasse-fints.source.js';
import { CsvImportService } from './csv-import.service.js';
import { ImportController } from './import.controller.js';
import { ImportPipeline } from './import.pipeline.js';
import { RecomputeService } from './recompute.service.js';

/** Registers CSV operations and the shared transactional import pipeline. */
@Module({
  controllers: [ImportController, SourcesController],
  providers: [CsvSource, CsvImportService, ImportPipeline, RecomputeService, SourcesRegistry, SparkasseFintsSource],
  exports: [ImportPipeline, RecomputeService, CsvSource, SourcesRegistry],
})
export class ImportModule {
  constructor(
    @Inject(SourcesRegistry) registry: SourcesRegistry,
    @Inject(CsvSource) csv: CsvSource,
    @Inject(SparkasseFintsSource) sparkasse: SparkasseFintsSource,
  ) {
    registry.register(csv);
    registry.register(sparkasse);
  }
}
