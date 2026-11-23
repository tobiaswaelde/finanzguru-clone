import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { realReturn, twror, xirr } from '../../src/domain/returns.js';

it('agrees with the reference XIRR and chained spreadsheet returns within 0.01 pp', () => {
  const fixture = JSON.parse(readFileSync(join(__dirname, '../fixtures/returns-reference.json'), 'utf8'));
  expect(xirr(fixture.flows)).toBeCloseTo(fixture.irr, 4);
  expect(twror(fixture.values)).toBeCloseTo(fixture.twror, 4);
  expect(realReturn(0.21, 0.1)).toBeCloseTo(0.1, 4);
});

it('rejects undefined rates and handles losing investments', () => {
  expect(xirr([{ date: '2023-01-01', amountCents: 100 }])).toBeNull();
  expect(twror([{ valueCents: 0, externalFlowCents: 0 }])).toBeNull();
  expect(
    xirr([
      { date: '2023-01-01', amountCents: -100 },
      { date: '2024-01-01', amountCents: 10 },
    ]),
  ).toBeCloseTo(-0.9, 4);
});
