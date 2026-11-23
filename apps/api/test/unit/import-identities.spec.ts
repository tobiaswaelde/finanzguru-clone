import { expect, it, vi } from 'vitest';
import { compileRuleRegex, createCategorizer } from '../../src/domain/categorize.js';
import { createFingerprinter, isDuplicate } from '../../src/domain/dedupe.js';

it('keeps identical bookings in one file and reproduces their identities on reimport', () => {
  const row = { accountId: 'a', bookingDate: '2026-01-01', amountCents: -123, counterparty: 'DEMO   STORE' };
  const first = createFingerprinter();
  const second = createFingerprinter();
  const keys = [first(row), first(row)];
  expect(new Set(keys).size).toBe(2);
  const equivalent = { ...row, counterparty: ' demo store ' };
  expect([second(equivalent), second(equivalent)]).toEqual(keys);
  const byFingerprint = vi.fn(() => true);
  expect(
    isDuplicate({ source: 'csv', sourceRef: 'ref', fingerprint: keys[0]! }, { bySourceRef: () => true, byFingerprint }),
  ).toBe(true);
  expect(byFingerprint).not.toHaveBeenCalled();
});

it('applies the first matching rule, identifies own transfers, and preserves manual classifications', () => {
  const categorize = createCategorizer(
    [
      { priority: 2, matchField: 'purpose', operator: 'contains', pattern: 'demo', categoryId: 'later' },
      {
        priority: 1,
        matchField: 'purpose',
        operator: 'regex',
        pattern: 'DEMO',
        amountSign: 'negative',
        categoryId: 'first',
      },
    ],
    ['DE1234'],
  );
  const row = { purpose: 'Demo Transfer', counterpartyIban: 'de 1234', amountCents: -50, type: 'expense' as const };
  expect(categorize(row)).toMatchObject({ type: 'transfer', categoryId: 'first', categorySource: 'rule' });
  const manual = { ...row, categorySource: 'manual' as const, categoryId: 'manual' };
  expect(categorize(manual)).toBe(manual);
  expect(() => compileRuleRegex('[')).toThrow();
});
