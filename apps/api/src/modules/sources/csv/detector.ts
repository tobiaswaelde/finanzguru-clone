import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';

const delimiters = [';', ',', '\t'] as const;
const sparkasse = [
  'auftragskonto',
  'buchungstag',
  'valutadatum',
  'buchungstext',
  'verwendungszweck',
  'beguenstigter/zahlungspflichtiger',
  'betrag',
  'waehrung',
];
const scalable = [
  'date',
  'time',
  'status',
  'reference',
  'description',
  'assettype',
  'type',
  'isin',
  'shares',
  'price',
  'amount',
  'fee',
  'tax',
  'currency',
];

/** Identification result used by import preview and mapping lookup. */
export interface CsvDetection {
  encoding: 'utf-8' | 'windows-1252';
  delimiter: (typeof delimiters)[number];
  format: 'sparkasse-camt-v8' | 'sparkasse-mt940' | 'scalable-transactions' | null;
  headers: string[];
  headerSignature: string;
}

/** Decode a CSV buffer, preferring strict UTF-8 unless explicitly overridden. */
export function decodeCsv(
  file: Buffer,
  encoding?: CsvDetection['encoding'],
): { text: string; encoding: CsvDetection['encoding'] } {
  if (encoding) return { text: new TextDecoder(encoding, { fatal: true }).decode(file), encoding };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(file), encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(file), encoding: 'windows-1252' };
  }
}

/** Normalize a German/English header without losing meaningful column order. */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/ä/gu, 'ae')
    .replace(/ö/gu, 'oe')
    .replace(/ü/gu, 'ue')
    .replace(/ß/gu, 'ss');
}

/** Parse the first CSV record with the selected delimiter, respecting quoted fields. */
function firstRecord(text: string, delimiter: CsvDetection['delimiter']): string[] {
  try {
    const parsed = parse(text, { delimiter, to: 1, skip_empty_lines: true, bom: true, trim: true }) as string[][];
    return parsed[0] ?? [];
  } catch {
    return [];
  }
}

/** Detect a supported header or provide a deterministic signature for a saved mapping. */
export function detectCsv(
  file: Buffer,
  options: { encoding?: CsvDetection['encoding']; delimiter?: CsvDetection['delimiter'] } = {},
): CsvDetection {
  const { text, encoding } = decodeCsv(file, options.encoding);
  let delimiter: CsvDetection['delimiter'] = options.delimiter ?? ';';
  let headers: string[] = [];
  for (const candidate of options.delimiter ? [options.delimiter] : delimiters) {
    const row = firstRecord(text, candidate);
    if (row.length > headers.length) {
      delimiter = candidate;
      headers = row;
    }
  }
  if (!headers.length) throw new Error('CSV header missing or malformed');
  const normalized = headers.map(normalizeHeader);
  const fields = new Set(normalized);
  let format: CsvDetection['format'] = null;
  if (fields.size === headers.length) {
    if (scalable.every((field) => fields.has(field))) format = 'scalable-transactions';
    else if (sparkasse.every((field) => fields.has(field))) {
      if (fields.has('kontonummer/iban')) format = 'sparkasse-camt-v8';
      else if (fields.has('kontonummer') && fields.has('blz') && fields.has('info')) format = 'sparkasse-mt940';
    }
  }
  return {
    headers,
    encoding,
    delimiter,
    format,
    headerSignature: createHash('sha256').update(JSON.stringify(normalized)).digest('hex'),
  };
}
