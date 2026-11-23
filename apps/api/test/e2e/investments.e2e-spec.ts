import { investmentClassesSchema, investmentPerformanceSchema, investmentPositionsSchema } from '@finance/shared';
import { eq } from 'drizzle-orm';
import { expect, it } from 'vitest';
import { account } from '../../src/database/schema.js';
import { ownerApp } from '../helpers/owner-app.js';

it('returns scoped portfolio performance, current holdings and realized sales', async () => {
  const { app, cookies, db } = await ownerApp({ demo: true });
  try {
    const base = '/api/investments';
    const response = await app.inject({ url: `${base}/positions?assetClass=etf`, cookies });
    expect(response.statusCode).toBe(200);
    expect(investmentPositionsSchema.parse(response.json())).toHaveLength(3);
    expect(
      investmentPositionsSchema.parse((await app.inject({ url: `${base}/positions?status=sold`, cookies })).json()),
    ).toMatchObject([{ realizedCents: 1300, quantity: '0' }]);
    expect(
      investmentPerformanceSchema.parse((await app.inject({ url: `${base}/performance`, cookies })).json()).valueCents,
    ).toBe(33900);
    expect(
      investmentClassesSchema.parse((await app.inject({ url: `${base}/asset-classes`, cookies })).json()),
    ).toHaveLength(2);
    const cash =
      db.select().from(account).where(eq(account.type, 'cash')).get() ??
      db.select().from(account).where(eq(account.type, 'checking')).get();
    expect((await app.inject({ url: `${base}/positions?accounts=${cash?.id}`, cookies })).json()).toEqual([]);
    expect((await app.inject({ url: `${base}/positions` })).statusCode).toBe(401);
  } finally {
    await app.close();
  }
});
