import { expect, it } from 'vitest';
import { cashflowSankey, summarizeCashflow, summarizeCategories, type FlowBooking } from '../../src/domain/cashflow.js';

it('excludes transfers, reports savings, and builds twelve calendar periods', () => {
  const bookingDate = '2026-11-10';
  const rows: FlowBooking[] = [
    { bookingDate, type: 'income', amountCents: 10000, categoryId: null },
    { bookingDate, type: 'expense', amountCents: -4000, categoryId: 'rent' },
    { bookingDate, type: 'buy', amountCents: -2000, categoryId: null },
    { bookingDate, type: 'transfer', amountCents: -9000, categoryId: null },
  ];
  const summary = summarizeCashflow(rows, 'quarter', '2026-11-22', '2026-11-23');
  expect(summary).toMatchObject({
    incomeCents: 10000,
    expenseCents: 4000,
    balanceCents: 6000,
    savedCents: 2000,
    savingsRate: 0.2,
  });
  expect(summary.bars).toHaveLength(12);
  expect(summary.bars.at(-1)).toMatchObject({ from: '2026-10-01', isCurrent: true });
  const categories = [
    { id: 'home', name: 'Wohnen', color: 'neutral', parentId: null },
    { id: 'rent', name: 'Miete', color: 'neutral', parentId: 'home' },
  ];
  expect(summarizeCategories(rows, categories, summary.period, 'expense').items[0]).toMatchObject({
    name: 'Wohnen',
    children: [{ totalCents: 4000 }],
  });
  const sankey = cashflowSankey(rows, categories, summary.period);
  expect(sankey.links.filter((link) => link.source === 'root').reduce((sum, link) => sum + link.valueCents, 0)).toBe(
    10000,
  );
});
