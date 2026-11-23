import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { detectCsv } from '../../src/modules/sources/csv/detector.js';

/** Read a fixture without altering its line delimiters or encoding. */
function fixture(name: string): Buffer {
  return readFileSync(join(__dirname, '../fixtures/csv', name));
}

it('detects the known broker and bank headers and legacy encoding', () => {
  expect(detectCsv(fixture('sparkasse-camt-v8.csv')).format).toBe('sparkasse-camt-v8');
  const legacy = Buffer.from(fixture('sparkasse-mt940.csv').toString('utf8'), 'latin1');
  expect(detectCsv(legacy)).toMatchObject({ format: 'sparkasse-mt940', encoding: 'windows-1252', delimiter: ';' });
  expect(detectCsv(fixture('scalable-transactions.csv')).format).toBe('scalable-transactions');
});

it('sniffs an unknown delimiter and keeps a canonical ordered signature', () => {
  const unknown = detectCsv(fixture('unknown-layout.csv'));
  expect(unknown).toMatchObject({ format: null, delimiter: ',' });
  expect(detectCsv(Buffer.from('"WHEN",How much,Counterparty,Notes\n')).headerSignature).toBe(unknown.headerSignature);
  expect(detectCsv(Buffer.from('When\t"Amount, EUR"\n')).delimiter).toBe('\t');
  expect(() => detectCsv(Buffer.alloc(0))).toThrow(/header/);
});
