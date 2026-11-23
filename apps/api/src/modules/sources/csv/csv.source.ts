import { Injectable } from '@nestjs/common';
import type { CsvMapping, SyncBatch } from '@finance/shared';
import type { DataSource, FetchInput } from '../data-source.interface.js';
import { detectCsv } from './detector.js';
import { parseGenericMapped } from './generic-mapped.js';
import { parseScalable } from './scalable.js';
import { parseSparkasse } from './sparkasse.js';

/** Reads CSV files and returns normalized records without persistence. */
@Injectable()
export class CsvSource implements DataSource {
  readonly kind = 'csv' as const;

  /** CSV uploads do not require a connection. */
  async status(): Promise<'active'> {
    return 'active';
  }

  /** Parse CSV input or reject an unsupported pull request. */
  async fetch(input: FetchInput): Promise<SyncBatch> {
    if (input.kind !== 'csv') throw new Error('CSV source requires an upload');
    return this.parse(input.file, input.mapping);
  }

  /** Route a staged file to its detected parser or an explicit mapping. */
  parse(file: Buffer, mapping?: CsvMapping): SyncBatch {
    const detection = detectCsv(file, mapping);
    if (mapping) return parseGenericMapped(file, mapping, 'selected', detection);
    if (detection.format === 'scalable-transactions') return parseScalable(file, detection);
    if (detection.format === 'sparkasse-camt-v8' || detection.format === 'sparkasse-mt940')
      return parseSparkasse(file, detection);
    throw new Error('CSV mapping required');
  }
}
