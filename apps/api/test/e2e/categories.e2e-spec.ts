import { categoryTreeSchema, ruleSchema } from '@finance/shared';
import { expect, it } from 'vitest';
import { ownerApp } from '../helpers/owner-app.js';

it('guards built-in categories, depth, rule priority and deterministic reapplication', async () => {
  const { app, cookies } = await ownerApp({ demo: true });
  try {
    const roots = categoryTreeSchema.parse((await app.inject({ url: '/api/categories', cookies })).json());
    const root = roots.find((row) => row.name === 'Wohnen');
    const child = root?.children[0];
    if (!root || !child) throw new Error('Missing seeded category');
    expect((await app.inject({ method: 'DELETE', url: `/api/categories/${root.id}`, cookies })).statusCode).toBe(409);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/categories',
          cookies,
          payload: { name: 'Too deep', kind: 'expense', color: 'neutral', parentId: child.id },
        })
      ).statusCode,
    ).toBe(400);
    const rule = {
      priority: 5,
      matchField: 'counterparty',
      operator: 'equals',
      pattern: 'Demo-Miete',
      categoryId: child.id,
    };
    const first = await app.inject({ method: 'POST', url: '/api/rules', cookies, payload: rule });
    expect(first.statusCode).toBe(201);
    expect(ruleSchema.parse(first.json()).priority).toBe(5);
    expect((await app.inject({ method: 'POST', url: '/api/rules', cookies, payload: rule })).statusCode).toBe(409);
    const apply = { method: 'POST' as const, url: '/api/rules/apply', cookies };
    expect((await app.inject(apply)).json()).toEqual({ updated: 36 });
    expect((await app.inject(apply)).json()).toEqual({ updated: 0 });
  } finally {
    await app.close();
  }
});
