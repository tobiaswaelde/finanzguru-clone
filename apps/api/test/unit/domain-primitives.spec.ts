import { expect, it } from 'vitest';
import { euroToCents, sumCents } from '../../src/domain/money.js';
import { calendarRange, resolvePeriod } from '../../src/domain/period.js';

it('rounds half to even and preserves cents through large intermediate sums', () => {
  expect([euroToCents('1.005'), euroToCents('1.015'), euroToCents('-1.015')]).toEqual([100, 102, -102]);
  expect(sumCents([Number.MAX_SAFE_INTEGER, 1, -1])).toBe(Number.MAX_SAFE_INTEGER);
  expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError);
});

it('uses UTC calendar periods with leap day and explicit range handling', () => {
  expect(resolvePeriod({ period: '1M' }, '2024-03-31', '2020-01-01')).toEqual({
    from: '2024-02-29',
    to: '2024-03-31',
  });
  expect(resolvePeriod({ period: '1M', from: '2024-01-01' }, '2024-03-31', '2020-01-01').from).toBe('2024-01-01');
  expect(calendarRange('quarter', '2024-12-31')).toEqual({ from: '2024-10-01', to: '2024-12-31' });
  expect(() => calendarRange('month', '2025-02-29')).toThrow(RangeError);
});
