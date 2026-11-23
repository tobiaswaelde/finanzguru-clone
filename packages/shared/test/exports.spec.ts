import { expect, it } from 'vitest';
import { accountsSchema, centsSchema, dateSchema, periodQuerySchema, sourceSchema } from '../src/index.js';

const id = '01940000-0000-7000-8000-000000000000';

it('validates the API date, cents, and account filter representations', () => {
  expect(dateSchema.safeParse('2025-02-29').success).toBe(false);
  expect(centsSchema.safeParse(12.5).success).toBe(false);
  expect(accountsSchema.safeParse(`${id},`).success).toBe(false);
  expect(periodQuerySchema.parse({ period: '1M', accounts: id })).toEqual({ period: '1M', accounts: id });
});

it('does not serialize private source fields', () => {
  expect(
    sourceSchema.parse({
      id,
      kind: 'csv',
      status: 'active',
      displayName: 'CSV',
      lastSyncAt: null,
      lastError: null,
      encryptedCredentials: 'not public',
    }),
  ).not.toHaveProperty('encryptedCredentials');
});
