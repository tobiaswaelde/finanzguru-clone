import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { detectCsv } from '../../src/modules/sources/csv/detector.js';
import { parseSparkasse } from '../../src/modules/sources/csv/sparkasse.js';

/** Load exact synthetic CSV fixture contents. */
function fixture(name: string): Buffer {
  return readFileSync(join(__dirname, '../fixtures/csv', name));
}

it('parses CAMT and legacy Windows-1252 MT940 exports', () => {
  const camt = fixture('sparkasse-camt-v8.csv');
  const batch = parseSparkasse(camt, detectCsv(camt));
  expect(batch.accounts[0]?.iban).toBe('DE89370400440532013000');
  expect(batch.transactions.map((row) => row.amountCents)).toEqual([100000, -2550]);
  expect(batch.transactions[1]?.purpose).toBe('Demo; Einkauf');
  const legacy = Buffer.from(fixture('sparkasse-mt940.csv').toString('utf8'), 'latin1');
  expect(parseSparkasse(legacy, detectCsv(legacy)).transactions[0]).toMatchObject({
    amountCents: -500,
    purpose: 'Testgebühr',
  });
});

it('keeps valid rows and reports invalid dates and amounts by line', () => {
  const file = fixture('malformed.csv');
  const batch = parseSparkasse(file, detectCsv(file));
  expect(batch.transactions).toHaveLength(1);
  expect(batch.rowErrors).toEqual([
    { line: 3, reason: 'invalid_date' },
    { line: 4, reason: 'invalid_amount' },
  ]);
});
