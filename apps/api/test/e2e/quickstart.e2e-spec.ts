import { expect, it } from 'vitest';
import { ownerApp } from '../helpers/owner-app.js';

it('publishes the locally supported contract in Swagger and protects owner settings', async () => {
  const { app, cookies } = await ownerApp();
  try {
    const docs = await app.inject({ url: '/api/docs-json' });
    expect(docs.statusCode).toBe(200);
    const paths = docs.json().paths;
    for (const [path, methods] of Object.entries({
      health: ['get'],
      'auth/login': ['post'],
      'auth/logout': ['post'],
      'auth/session': ['get'],
      'overview/net-worth': ['get'],
      'overview/allocation': ['get'],
      'overview/kpis': ['get'],
      'overview/holdings/top-flop': ['get'],
      'accounts/tree': ['get'],
      'transactions/unreviewed/count': ['get'],
      'dashboard/layout': ['get', 'put'],
      'investments/performance': ['get'],
      'investments/positions': ['get'],
      'investments/positions.csv': ['get'],
      'investments/asset-classes': ['get'],
      'investments/instruments/{id}': ['get'],
      'investments/transactions': ['get'],
      'cashflow/summary': ['get'],
      'cashflow/sankey': ['get'],
      'cashflow/categories': ['get'],
      transactions: ['get', 'post'],
      'transactions/{id}': ['patch'],
      categories: ['get', 'post'],
      'categories/{id}': ['patch', 'delete'],
      rules: ['get', 'post'],
      'rules/{id}': ['patch', 'delete'],
      'rules/apply': ['post'],
      budgets: ['get', 'post'],
      'budgets/{id}': ['patch', 'delete'],
      insurance: ['get', 'post'],
      'insurance/{id}': ['patch', 'delete'],
      accounts: ['get', 'post'],
      'accounts/{id}': ['patch', 'delete'],
      sources: ['get'],
      'import/csv': ['post'],
      'import/csv/{id}/confirm': ['post'],
      'import/jobs/{id}': ['get'],
      'csv-mappings': ['get', 'post'],
      'csv-mappings/{id}': ['delete'],
      settings: ['get', 'patch'],
    })) {
      for (const method of methods) expect(paths[`/api/${path}`]?.[method], `${method} /api/${path}`).toBeDefined();
    }
    expect((await app.inject({ url: '/api/overview/kpis' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/settings' })).statusCode).toBe(401);
    const patch = { method: 'PATCH' as const, url: '/api/settings', cookies };
    expect((await app.inject({ ...patch, payload: { inflationRate: '0.6' } })).statusCode).toBe(400);
    expect((await app.inject({ ...patch, payload: { inflationRate: '0.03' } })).json()).toEqual({
      displayName: 'Demo',
      inflationRate: '0.03',
    });
    expect((await app.inject({ url: '/api/overview/kpis', cookies })).json().inflation).toBe('0.03');
  } finally {
    await app.close();
  }
});
