import type { SyncBatch } from '@finance/shared';
import { dateSchema } from '@finance/shared';
import { parse } from 'csv-parse/sync';
import { euroToCents } from '../../../domain/money.js';
import { type CsvDetection, decodeCsv } from './detector.js';

/** Parsed row with its physical source line and an optional syntax error. */
export interface CsvRow {
  line: number;
  cells: string[];
  error?: string;
}

/** Parse data records and retain line numbers; malformed records do not poison valid-width neighbors. */
export function readRows(file: Buffer, detection: CsvDetection, skipRows = 0, limit?: number): CsvRow[] {
  const { text } = decodeCsv(file, detection.encoding);
  const rows = parse(text, {
    bom: true,
    delimiter: detection.delimiter,
    skip_empty_lines: true,
    info: true,
    relax_column_count: true,
    trim: true,
    from: skipRows + 2,
    to: limit === undefined ? undefined : skipRows + 1 + limit,
  }) as unknown as { record: string[]; info: { lines: number } }[]; // csv-parse's sync types omit the info wrapper.
  return rows.map(({ record, info }) => ({
    line: info.lines,
    cells: record,
    error: record.length === detection.headers.length ? undefined : 'invalid_column_count',
  }));
}

/** Convert a German or ISO calendar date; two-digit years denote 2000–2099. */
export function parseCsvDate(value: string | undefined, format: string): string | undefined {
  if (!value) return undefined;
  if (format === 'YYYY-MM-DD') return dateSchema.safeParse(value).success ? value : undefined;
  const match = /^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/u.exec(value);
  if (!match) return undefined;
  const [, day, month, rawYear] = match;
  if (!rawYear || rawYear.length !== (format === 'DD.MM.YY' ? 2 : 4)) return undefined;
  const date = `${rawYear.length === 2 ? `20${rawYear}` : rawYear}-${month}-${day}`;
  return dateSchema.safeParse(date).success ? date : undefined;
}

/** Parse delimited decimal input without interpreting malformed grouping or an exponent. */
export function parseCsvDecimal(raw: string | undefined, separator: ',' | '.'): string | undefined {
  const value = raw?.trim().replace(/^['’]/u, '');
  if (!value) return undefined;
  const grammar =
    separator === ',' ? /^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/u : /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/u;
  if (!grammar.test(value)) return undefined;
  const normalized = separator === ',' ? value.replace(/\./gu, '').replace(',', '.') : value.replace(/,/gu, '');
  const unsigned = normalized.replace(/^\+/u, '');
  return unsigned.replace(/^(-?)0+(?=\d)/u, '$1');
}

/** Convert a valid decimal amount to cents; return undefined for overflow. */
export function parseCsvCents(value: string | undefined, separator: ',' | '.'): number | undefined {
  const decimal = parseCsvDecimal(value, separator);
  if (decimal === undefined) return undefined;
  try {
    return euroToCents(decimal);
  } catch {
    return undefined;
  }
}

/** Initialize the normalized pipeline output for a CSV file. */
export function emptyBatch(): SyncBatch {
  return { accounts: [], instruments: [], prices: [], transactions: [], rowErrors: [] };
}
