import { allocationSchema, kpisSchema, topFlopSchema } from '@finance/shared';
import { expect, it } from 'vitest';
import { ownerApp } from '../helpers/owner-app.js';

it('serves allocation, realized gains, and holding changes for the demo portfolio', async () => {
  const { app, cookies } = await ownerApp({ demo: true });
  try {
    const allocation = await app.inject({ url: '/api/overview/allocation', cookies });
    expect(allocation.statusCode).toBe(200);
    expect(allocationSchema.parse(allocation.json()).totalCents).toBe(6507200);
    const kpis = await app.inject({ url: '/api/overview/kpis', cookies });
    expect(kpis.statusCode).toBe(200);
    expect(kpisSchema.parse(kpis.json()).realized.netCents).toBe(1300);
    const holdings = await app.inject({ url: '/api/overview/holdings/top-flop?range=1M', cookies });
    expect(holdings.statusCode).toBe(200);
    expect(topFlopSchema.parse(holdings.json()).top).toHaveLength(4);
    expect((await app.inject({ url: '/api/overview/allocation', cookies: {} })).statusCode).toBe(401);
  } finally {
    await app.close();
  }
});
