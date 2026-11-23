import { expect, it } from 'vitest';
import { PositionBook } from '../../src/domain/positions.js';

it('applies FIFO, partial sales and splits without changing remaining cost basis', () => {
  const book = new PositionBook();
  const base = { instrumentId: 'ETF', date: '2026-01-01' };
  book.apply({ ...base, type: 'buy', quantity: '2', unitPrice: '10' });
  book.apply({ ...base, type: 'buy', quantity: '1', unitPrice: '20' });
  book.apply({ ...base, type: 'split', quantity: '2' });
  book.apply({ ...base, type: 'sell', quantity: '5', unitPrice: '12', feeCents: 100 });
  expect(book.getLots().map((lot) => lot.quantityOpen)).toEqual(['0', '1']);
  expect(book.realizedCents()).toBe(2900);
  expect(book.averagePrice('ETF')).toBe('10');
  expect(() => book.apply({ ...base, type: 'sell', quantity: '2', unitPrice: '12' })).toThrow(RangeError);
});
