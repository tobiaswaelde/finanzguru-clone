import { expect, it } from 'vitest';
import { formatDate, formatEur, formatPct, isValidIban, isValidIsin } from '../src/index.js';

it('formats dates, amounts, and signed returns in German', () => {
  expect(formatDate('2026-11-23')).toBe('23.11.2026');
  expect(formatEur(185645)).toBe('1.856,45\u00a0€');
  expect(formatEur(-100, true)).toBe('-1,00\u00a0€');
  expect(formatPct('0.0125', true)).toBe('+1,25\u00a0%');
});

it('checks IBAN and ISIN control digits', () => {
  expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true);
  expect(isValidIban('DE89 3704 0044 0532 0130 01')).toBe(false);
  expect(isValidIsin('US0378331005')).toBe(true);
  expect(isValidIsin('US0378331006')).toBe(false);
});
