import { investmentDetailSchema, investmentPositionsSchema, investmentTransactionsSchema } from '@finance/shared';
import { expect, it } from 'vitest';
import { ownerApp } from '../helpers/owner-app.js';

it('exports selected columns and scopes detail and paginated transactions', async () => {
  const { app, cookies } = await ownerApp({ demo: true });
  try {
    const base = '/api/investments';
    const payload = investmentPositionsSchema.parse((await app.inject({ url: `${base}/positions`, cookies })).json());
    const id = payload[0]?.instrumentId;
    const csv = await app.inject({ url: `${base}/positions.csv?assetClass=etf&columns=name,valueCents`, cookies });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body.split('\r\n')[0]).toBe('\uFEFFname;valueCents');
    expect(csv.body).toContain('"120,00"');
    expect((await app.inject({ url: `${base}/positions.csv?columns=unknown`, cookies })).statusCode).toBe(400);
    const detail = await app.inject({ url: `${base}/instruments/${id}?period=1M`, cookies });
    expect(investmentDetailSchema.parse(detail.json()).series.length).toBeGreaterThan(20);
    expect((await app.inject({ url: `${base}/instruments/absent`, cookies })).statusCode).toBe(404);
    const results = investmentTransactionsSchema.parse(
      (await app.inject({ url: `${base}/transactions?type=buy&pageSize=2&page=2`, cookies })).json(),
    );
    expect(results).toMatchObject({ total: 5, items: [{ type: 'buy' }, { type: 'buy' }] });
  } finally {
    await app.close();
  }
});
