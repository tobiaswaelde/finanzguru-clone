import { insuranceContractSchema } from '@finance/shared';
import { expect, it } from 'vitest';
import { ownerApp } from '../helpers/owner-app.js';

it('validates contract dates and derives annual costs through create, edit and deletion', async () => {
  const { app, cookies } = await ownerApp();
  try {
    const url = '/api/insurance';
    expect((await app.inject({ url })).statusCode).toBe(401);
    const input = {
      provider: 'Demo insurer',
      type: 'term_life',
      startDate: '2026-01-01',
      premiumCents: 2362,
      interval: 'monthly',
    };
    const create = await app.inject({ url, method: 'POST', cookies, payload: input });
    expect(create.statusCode).toBe(201);
    const contract = insuranceContractSchema.parse(create.json());
    expect(contract.yearlyCostCents).toBe(28344);
    const change = { url: `${url}/${contract.id}`, method: 'PATCH' as const, cookies };
    expect((await app.inject({ ...change, payload: { endDate: '2025-01-01' } })).statusCode).toBe(400);
    const updated = await app.inject({ ...change, payload: { interval: 'quarterly' } });
    expect(insuranceContractSchema.parse(updated.json()).yearlyCostCents).toBe(9448);
    expect((await app.inject({ url: change.url, method: 'DELETE', cookies })).statusCode).toBe(204);
    expect((await app.inject({ url, cookies })).json()).toEqual([]);
  } finally {
    await app.close();
  }
});
