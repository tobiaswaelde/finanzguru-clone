import { budgetSchema } from '@finance/shared';
import { eq } from 'drizzle-orm';
import { expect, it } from 'vitest';
import { category } from '../../src/database/schema.js';
import { ownerApp } from '../helpers/owner-app.js';

it('enforces expense categories and reflects categorized expenses in their parent budget', async () => {
  const { app, cookies, db } = await ownerApp();
  try {
    const groceries = db.select().from(category).where(eq(category.name, 'Lebensmittel und Getränke')).get();
    const salary = db.select().from(category).where(eq(category.name, 'Gehalt')).get();
    if (!groceries?.parentId || !salary) throw new Error('Missing seeded category');
    const request = { method: 'POST' as const, url: '/api/budgets', cookies };
    expect(
      (await app.inject({ ...request, payload: { categoryId: salary.id, monthlyLimitCents: 50000 } })).statusCode,
    ).toBe(400);
    const input = { categoryId: groceries.parentId, monthlyLimitCents: 50000 };
    const created = budgetSchema.parse((await app.inject({ ...request, payload: input })).json());
    expect((await app.inject({ ...request, payload: input })).statusCode).toBe(409);
    const cash = (
      await app.inject({
        method: 'POST',
        url: '/api/accounts',
        cookies,
        payload: { name: 'Cash', type: 'cash' },
      })
    ).json();
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/transactions',
          cookies,
          payload: {
            accountId: cash.id,
            bookingDate: new Date().toISOString().slice(0, 10),
            type: 'expense',
            amountCents: -1234,
            categoryId: groceries.id,
          },
        })
      ).statusCode,
    ).toBe(201);
    expect((await app.inject({ url: '/api/budgets', cookies })).json()).toMatchObject([
      { spentCents: 1234, remainingCents: 48766 },
    ]);
    expect((await app.inject({ method: 'DELETE', url: `/api/budgets/${created.id}`, cookies })).statusCode).toBe(204);
  } finally {
    await app.close();
  }
});
