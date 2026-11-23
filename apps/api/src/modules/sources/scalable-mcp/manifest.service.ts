import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type FinanceDatabase } from '../../../database/drizzle.module.js';
import { dataSource } from '../../../database/schema.js';
import type { ScalableManifestItem } from './client.js';

/** Stores allowlist decisions without storing tool results or exposing credentials. */
@Injectable()
export class ScalableManifestService {
  constructor(@Inject(DB) private readonly db: FinanceDatabase) {}

  /** Persist the reviewed names and decisions against the active source record. */
  store(sourceId: string, manifest: readonly ScalableManifestItem[]): boolean {
    const decisions = manifest.map(({ name, allowed }) => ({ name, allowed }));
    return (
      this.db
        .update(dataSource)
        .set({ toolManifest: decisions })
        .where(and(eq(dataSource.id, sourceId), eq(dataSource.kind, 'scalable_mcp')))
        .run().changes > 0
    );
  }
}
