import { netWorthSchema } from '@finance/shared';
import { eq } from 'drizzle-orm';
import { expect, it } from 'vitest';
import { account } from '../../src/database/schema.js';
import { ownerApp } from '../helpers/owner-app.js';

it('returns the demo total to the cent and enforces account scope', async () => {
  const { app, cookies, db } = await ownerApp({ demo: true });
  try {
    const path = '/api/overview/net-worth';
    expect((await app.inject({ url: path })).statusCode).toBe(401);
    expect((await app.inject({ url: `${path}?mode=unknown`, cookies })).statusCode).toBe(400);
    const all = netWorthSchema.parse((await app.inject({ url: path, cookies })).json());
    expect(all.totalCents).toBe(6507200);
    expect(all.series).toHaveLength(400);
    expect(all.series.at(-1)?.date).toBe('2026-11-22');
    const cash = db.select().from(account).where(eq(account.type, 'checking')).get();
    if (!cash) throw new Error('Missing synthetic account');
    const scope = `${path}?accounts=${cash.id}&period=1M&mode=return`;
    expect(netWorthSchema.parse((await app.inject({ url: scope, cookies })).json()).totalCents).toBe(6300000);
    db.update(account).set({ isHidden: true }).where(eq(account.id, cash.id)).run();
    expect(netWorthSchema.parse((await app.inject({ url: scope, cookies })).json()).series).toEqual([]);
  } finally {
    await app.close();
  }
});
