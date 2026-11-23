import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { csvMappingInputSchema, type csvConfirmSchema, type saveCsvMappingSchema } from '@finance/shared';
import { createHash } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { DB, type FinanceDatabase } from '../../database/drizzle.module.js';
import { account, csvMapping, dataSource, importJob } from '../../database/schema.js';
import { CsvSource } from '../sources/csv/csv.source.js';
import { detectCsv } from '../sources/csv/detector.js';
import { readRows } from '../sources/csv/rows.js';
import { ImportPipeline } from './import.pipeline.js';

const previewTtl = 15 * 60_000;
const maxPreviews = 4;

/** Manages import previews and saved mappings for the single owner. */
@Injectable()
export class CsvImportService {
  private readonly pending = new Map<string, { file: Buffer; expiresAt: number }>();

  constructor(
    @Inject(DB) private readonly db: FinanceDatabase,
    @Inject(CsvSource) private readonly source: CsvSource,
    @Inject(ImportPipeline) private readonly pipeline: ImportPipeline,
  ) {}

  /** Stage bounded CSV bytes in memory and return an authenticated preview. */
  preview(file: Buffer, fileName: string, opts: { accountId?: string; mappingId?: string }) {
    for (const [id, stage] of this.pending) if (stage.expiresAt <= Date.now()) this.expire(id);
    if (this.pending.size >= maxPreviews) throw new ServiceUnavailableException();
    const sourceId = this.db.select({ id: dataSource.id }).from(dataSource).where(eq(dataSource.kind, 'csv')).get()?.id;
    if (!sourceId) throw new ServiceUnavailableException();
    if (opts.accountId) this.assertAccount(opts.accountId);
    let detected;
    let rows;
    try {
      detected = detectCsv(file);
      rows = readRows(file, detected, 0, 10).map((row) => row.cells);
    } catch {
      throw new BadRequestException();
    }
    const saved = this.db
      .select()
      .from(csvMapping)
      .where(
        opts.mappingId ? eq(csvMapping.id, opts.mappingId) : eq(csvMapping.headerSignature, detected.headerSignature),
      )
      .get();
    if (opts.mappingId && !saved) throw new NotFoundException();
    if (saved && saved.headerSignature !== detected.headerSignature) throw new BadRequestException();
    const mapping = saved ? csvMappingInputSchema.parse(saved) : undefined;
    const detectedFormat = mapping ? ('generic' as const) : detected.format;
    const job = this.db
      .insert(importJob)
      .values({
        sourceId,
        kind: 'csv_upload',
        status: 'running',
        startedAt: new Date().toISOString(),
        fileName: fileName.slice(0, 255),
        fileSha256: createHash('sha256').update(file).digest('hex'),
        format: detectedFormat,
      })
      .returning({ id: importJob.id })
      .get();
    this.pending.set(job.id, { file, expiresAt: Date.now() + previewTtl });
    return {
      jobId: job.id,
      detectedFormat,
      needsMapping: detectedFormat === null,
      preview: rows,
      headers: detected.headers,
      mapping,
      accountId: opts.accountId ?? saved?.defaultAccountId ?? undefined,
    };
  }

  /** Run the normalized import after confirmation; malformed input is retryable. */
  confirm(id: string, input: ReturnType<typeof csvConfirmSchema.parse>) {
    const job = this.job(id);
    if (job.kind !== 'csv_upload' || job.status !== 'running') throw new ConflictException();
    const staged = this.pending.get(id);
    if (!staged) throw new ConflictException();
    this.assertAccount(input.accountId);
    const detection = detectCsv(staged.file);
    const saved = this.db
      .select()
      .from(csvMapping)
      .where(eq(csvMapping.headerSignature, detection.headerSignature))
      .get();
    const mapping = input.mapping ?? (saved ? csvMappingInputSchema.parse(saved) : undefined);
    let batch;
    try {
      batch = this.source.parse(staged.file, mapping);
    } catch {
      throw new BadRequestException();
    }
    const result = this.pipeline.run(id, batch, { accountId: input.accountId });
    this.pending.delete(id);
    if (result.status !== 'failed' && mapping && input.saveMappingAs) {
      this.save({
        ...mapping,
        name: input.saveMappingAs,
        headerSignature: detection.headerSignature,
        defaultAccountId: input.accountId,
        delimiter: mapping.delimiter ?? detection.delimiter,
        encoding: mapping.encoding ?? detection.encoding,
        dateFormat: mapping.dateFormat ?? 'YYYY-MM-DD',
        decimalSeparator: mapping.decimalSeparator ?? (detection.delimiter === ';' ? ',' : '.'),
        skipRows: mapping.skipRows ?? 0,
      });
    }
    return result;
  }

  /** Read a job, closing expired previews (including previous process runs). */
  job(id: string) {
    const row = this.db.select().from(importJob).where(eq(importJob.id, id)).get();
    if (!row) throw new NotFoundException();
    if (row.kind === 'csv_upload' && row.status === 'running' && (this.pending.get(id)?.expiresAt ?? 0) <= Date.now()) {
      this.expire(id);
      return this.db.select().from(importJob).where(eq(importJob.id, id)).get() ?? row;
    }
    return row;
  }

  /** List stored mapping presets without exposing staged file content. */
  list() {
    return this.db.select().from(csvMapping).orderBy(asc(csvMapping.name)).all();
  }

  /** Insert or replace the mapping for a canonical header signature. */
  save(input: ReturnType<typeof saveCsvMappingSchema.parse>) {
    if (input.defaultAccountId) this.assertAccount(input.defaultAccountId);
    return this.db
      .insert(csvMapping)
      .values(input)
      .onConflictDoUpdate({ target: csvMapping.headerSignature, set: input })
      .returning()
      .get();
  }

  /** Remove a preset without touching historical imports. */
  remove(id: string): void {
    if (!this.db.delete(csvMapping).where(eq(csvMapping.id, id)).run().changes) throw new NotFoundException();
  }

  /** Reject an absent or hidden target account. */
  private assertAccount(id: string): void {
    if (
      !this.db
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.id, id), eq(account.isHidden, false)))
        .get()
    ) {
      throw new NotFoundException();
    }
  }

  /** Release staged bytes and close the job without storing file data. */
  private expire(id: string): void {
    this.pending.delete(id);
    this.db
      .update(importJob)
      .set({ status: 'failed', errors: [{ reason: 'preview_expired' }], finishedAt: new Date().toISOString() })
      .where(and(eq(importJob.id, id), eq(importJob.status, 'running')))
      .run();
  }
}
