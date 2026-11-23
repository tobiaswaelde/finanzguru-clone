import {
  cashflowSankeySchema,
  cashflowSummarySchema,
  investmentTransactionsSchema,
  transactionSchema,
} from '@finance/shared';
import { eq } from 'drizzle-orm';
import { expect, it } from 'vitest';
import { category } from '../../src/database/schema.js';
import { ownerApp } from '../helpers/owner-app.js';

it('summarizes cash flow and reviews a filtered booking with a reusable rule', async () => {
  const { app, db, cookies } = await ownerApp({ demo: true });
  try {
    const query = 'anchor=2026-11-01&granularity=month';
    const summary = await app.inject({ url: `/api/cashflow/summary?${query}`, cookies });
    expect(cashflowSummarySchema.parse(summary.json())).toMatchObject({ incomeCents: 300000, expenseCents: 125000 });
    expect(
      cashflowSankeySchema.parse((await app.inject({ url: `/api/cashflow/sankey?${query}`, cookies })).json()).links
        .length,
    ).toBeGreaterThan(0);
    const list = investmentTransactionsSchema.parse(
      (await app.inject({ url: '/api/transactions?status=unreviewed&q=Demo-Miete', cookies })).json(),
    );
    expect(list.total).toBe(36);
    const booking = list.items[0];
    const target = db.select().from(category).where(eq(category.name, 'Miete / Wohngeld')).get();
    if (!booking || !target) throw new Error('Missing synthetic booking or category');
    const url = `/api/transactions/${booking.id}`;
    const saved = await app.inject({
      method: 'PATCH',
      url,
      cookies,
      payload: {
        categoryId: target.id,
        createRule: { matchField: 'counterparty', operator: 'equals', pattern: 'Demo-Miete' },
      },
    });
    expect(transactionSchema.parse(saved.json())).toMatchObject({ categoryId: target.id, reviewStatus: 'reviewed' });
    expect((await app.inject({ url: '/api/transactions?status=unreviewed&q=Demo-Miete', cookies })).json().total).toBe(
      35,
    );
    expect((await app.inject({ method: 'PATCH', url, payload: { categoryId: target.id } })).statusCode).toBe(401);
  } finally {
    await app.close();
  }
});
