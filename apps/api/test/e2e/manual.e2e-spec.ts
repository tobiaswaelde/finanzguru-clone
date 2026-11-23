import { accountSchema, netWorthSchema, transactionSchema } from '@finance/shared';
import { expect, it } from 'vitest';
import { ownerApp } from '../helpers/owner-app.js';

it('creates a manual account and booking, updates totals, and guards forced deletion', async () => {
  const { app, cookies } = await ownerApp();
  try {
    const create = await app.inject({
      method: 'POST',
      url: '/api/accounts',
      cookies,
      payload: { name: 'Cash demo', type: 'cash', balanceCents: 1000 },
    });
    expect(create.statusCode).toBe(201);
    const created = accountSchema.parse(create.json());
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/accounts/${created.id}`,
          cookies,
          payload: { name: 'Renamed' },
        })
      ).json().name,
    ).toBe('Renamed');
    const booked = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      cookies,
      payload: { accountId: created.id, type: 'expense', amountCents: -200, bookingDate: '2026-01-02' },
    });
    expect(booked.statusCode).toBe(201);
    expect(transactionSchema.parse(booked.json()).source).toBe('manual');
    expect(
      netWorthSchema.parse((await app.inject({ url: '/api/overview/net-worth', cookies })).json()).totalCents,
    ).toBe(800);
    expect((await app.inject({ method: 'DELETE', url: `/api/accounts/${created.id}`, cookies })).statusCode).toBe(409);
    expect((await app.inject({ method: 'DELETE', url: `/api/accounts/${created.id}?force=true` })).statusCode).toBe(
      401,
    );
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/accounts/${created.id}?force=true`, cookies })).statusCode,
    ).toBe(204);
  } finally {
    await app.close();
  }
});
