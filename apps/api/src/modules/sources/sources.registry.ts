import { Injectable } from '@nestjs/common';
import type { DataSource, SourceKind } from './data-source.interface.js';
import { NotImplementedError } from './errors.js';

/** Resolves one adapter per external source kind. */
@Injectable()
export class SourcesRegistry {
  private readonly sources = new Map<SourceKind, DataSource>();

  /** Register an adapter once; reject accidental provider replacement. */
  register(source: DataSource): void {
    if (this.sources.has(source.kind)) throw new Error(`Duplicate source adapter: ${source.kind}`);
    this.sources.set(source.kind, source);
  }

  /** Return the adapter or report that this source is not implemented. */
  get(kind: SourceKind): DataSource {
    const source = this.sources.get(kind);
    if (!source) throw new NotImplementedError(`Source adapter unavailable: ${kind}`);
    return source;
  }
}
