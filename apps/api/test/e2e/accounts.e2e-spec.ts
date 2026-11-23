import { accountsListSchema, accountsTreeSchema } from '@finance/shared';
import { eq } from 'drizzle-orm';
import { expect, it } from 'vitest';
import { account } from '../../src/database/schema.js';
import { ownerApp } from '../helpers/owner-app.js';

it('groups the demo reference account and respects hidden or out-of-scope accounts', async () => {
  const { app, cookies, db } = await ownerApp({ demo: true });
  try {
    const accounts = accountsListSchema.parse((await app.inject({ url: '/api/accounts', cookies })).json());
    expect(accounts).toHaveLength(3);
    const reference = accounts.find((row) => row.type === 'reference');
    if (!reference) throw new Error('Demo reference account missing');
    const tree = accountsTreeSchema.parse((await app.inject({ url: '/api/accounts/tree', cookies })).json());
    expect(tree.groups[0]).toMatchObject({
      type: 'depots',
      totalCents: 207200,
      items: [{ children: [{ id: reference.id }] }],
    });
    const url = `/api/transactions/unreviewed/count?accounts=${reference.id}`;
    expect((await app.inject({ url, cookies })).json()).toEqual({ count: 6 });
    db.update(account).set({ isHidden: true }).where(eq(account.id, reference.id)).run();
    expect((await app.inject({ url, cookies })).json()).toEqual({ count: 0 });
    expect((await app.inject({ url: `/api/accounts?accounts=${reference.id}`, cookies })).json()).toEqual([]);
    expect((await app.inject({ url: '/api/accounts/tree' })).statusCode).toBe(401);
  } finally {
    await app.close();
  }
});
