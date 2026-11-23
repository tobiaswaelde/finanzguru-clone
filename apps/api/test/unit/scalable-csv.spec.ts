import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { detectCsv } from '../../src/modules/sources/csv/detector.js';
import { parseScalable } from '../../src/modules/sources/csv/scalable.js';

it('normalizes savings plans and distributions and skips unexecuted bookings', () => {
  const file = readFileSync(join(__dirname, '../fixtures/csv/scalable-transactions.csv'));
  const batch = parseScalable(file, detectCsv(file), 'test-depot');
  expect(batch.transactions).toMatchObject([
    { accountExternalRef: 'test-depot', sourceRef: 'demo-1', type: 'buy', amountCents: -10000, unitPrice: '50' },
    { sourceRef: 'demo-2', type: 'dividend', amountCents: 250 },
  ]);
  expect(batch.instruments).toMatchObject([{ isin: 'IE00B4L5Y983', assetClass: 'etf' }]);
  expect(batch.rowErrors).toEqual([{ line: 4, reason: 'not_executed' }]);
});
