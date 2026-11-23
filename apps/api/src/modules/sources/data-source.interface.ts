import type { CsvMapping, SourceKind, SourceStatus, SyncBatch } from '@finance/shared';

export type {
  NormalizedAccount,
  NormalizedInstrument,
  NormalizedPrice,
  NormalizedTransaction,
  SourceKind,
  SourceStatus,
  SyncBatch,
} from '@finance/shared';

/** CSV upload or read-only pull configuration. */
export type FetchInput =
  { kind: 'csv'; file: Buffer; fileName: string; mapping?: CsvMapping } | { kind: 'pull'; since?: string };

/** Source adapter that never writes to an external provider. */
export interface DataSource {
  readonly kind: SourceKind;
  /** Report provider state without changing remote state. */
  status(): Promise<SourceStatus>;
  /** Parse an upload or read incremental source data. */
  fetch(input: FetchInput): Promise<SyncBatch>;
}
