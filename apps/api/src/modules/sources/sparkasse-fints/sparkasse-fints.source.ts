import { Injectable } from '@nestjs/common';
import type { SyncBatch } from '@finance/shared';
import type { DataSource } from '../data-source.interface.js';
import { NotImplementedError } from '../errors.js';

/** Reserves the Sparkasse live interface without making any bank connection. */
@Injectable()
export class SparkasseFintsSource implements DataSource {
  readonly kind = 'sparkasse_fints' as const;

  /** Signal that this provider is not available. */
  async status(): Promise<'planned'> {
    return 'planned';
  }

  /** Reject every fetch without reading, writing, or dialing a real bank. */
  async fetch(): Promise<SyncBatch> {
    throw new NotImplementedError('Sparkasse live access is planned');
  }
}
