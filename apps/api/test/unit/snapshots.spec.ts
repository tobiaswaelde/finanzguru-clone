import { expect, it } from 'vitest';
import { buildSnapshots } from '../../src/domain/snapshots.js';

it('carries the last quote forward and marks it stale', () => {
  const snapshots = buildSnapshots({
    depot: true,
    openingCashCents: 0,
    from: '2026-01-01',
    to: '2026-01-02',
    events: [
      { date: '2026-01-01', type: 'buy', instrumentId: 'ETF', quantity: '2', unitPrice: '10', amountCents: -2000 },
    ],
    prices: [{ instrumentId: 'ETF', date: '2026-01-01', close: '12' }],
  });
  expect(snapshots).toEqual([
    { date: '2026-01-01', valueCents: 2400, investedCents: 2000, externalFlowCents: 2000, stale: false },
    { date: '2026-01-02', valueCents: 2400, investedCents: 2000, externalFlowCents: 0, stale: true },
  ]);
});
