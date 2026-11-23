import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { parseGenericMapped } from '../../src/modules/sources/csv/generic-mapped.js';

it('uses mapped column indexes and preserves quoted text', () => {
  const file = readFileSync(join(__dirname, '../fixtures/csv/unknown-layout.csv'));
  const result = parseGenericMapped(file, { columns: { date: 0, amount: 1, counterparty: 2, purpose: 3 } }, 'test');
  expect(result.transactions.map((row) => row.amountCents)).toEqual([15025, -250]);
  expect(result.transactions[0]?.purpose).toBe('Quoted, note');
  expect(result.rowErrors).toEqual([]);
});

it('supports German dates, grouping, and skipped rows', () => {
  const file = Buffer.from('Datum;Summe\nskip;this\n29.02.2024;1.000,02\n01.03.2024;-0,50\n');
  const result = parseGenericMapped(
    file,
    { columns: { date: 0, amount: 1 }, dateFormat: 'DD.MM.YYYY', decimalSeparator: ',', skipRows: 1 },
    'test',
  );
  expect(result.transactions).toMatchObject([
    { bookingDate: '2024-02-29', amountCents: 100002 },
    { bookingDate: '2024-03-01', amountCents: -50 },
  ]);
});
