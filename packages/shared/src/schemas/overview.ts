import { z } from 'zod';
import { assetClasses } from '../enums.js';
import { accountsSchema, centsSchema, dateSchema, decimalSchema, idSchema, periodQuerySchema } from './common.js';

export const netWorthQuerySchema = periodQuerySchema.extend({
  mode: z.enum(['value', 'return']).default('value'),
});

export const netWorthPointSchema = z.object({
  date: dateSchema,
  valueCents: centsSchema,
  investedCents: centsSchema,
  cashCents: centsSchema,
  returnPct: z.number().nullable(),
});

export const netWorthSchema = z.object({
  totalCents: centsSchema.nullable(),
  gainCents: centsSchema.nullable(),
  gainPct: z.number().nullable(),
  series: z.array(netWorthPointSchema).max(400),
});

export const allocationQuerySchema = z.object({
  accounts: accountsSchema.optional(),
  unit: z.enum(['eur', 'pct']).default('eur'),
});
export const allocationSchema = z.object({
  totalCents: centsSchema,
  slices: z.array(
    z.object({
      key: z.enum([...assetClasses, 'cash']),
      label: z.string(),
      count: z.int().nonnegative(),
      valueCents: centsSchema,
      pct: z.number().nullable(),
    }),
  ),
});

const pairedCents = z.object({ grossCents: centsSchema, netCents: centsSchema });
export const kpisSchema = z.object({
  investedCents: centsSchema.nullable(),
  priceGain: z.object({ cents: centsSchema, pct: z.number().nullable() }),
  realized: pairedCents.extend({ pct: z.number().nullable() }),
  otherGainsCents: centsSchema,
  dividends: pairedCents,
  interest: pairedCents,
  taxesFeesCents: centsSchema,
  totalReturnCents: centsSchema.nullable(),
  twror: decimalSchema.nullable(),
  irr: decimalSchema.nullable(),
  inflation: decimalSchema,
  realReturn: decimalSchema.nullable(),
});

export const holdingQuerySchema = z.object({
  accounts: accountsSchema.optional(),
  range: z.enum(['1D', '1W', '1M', '1Y']).default('1D'),
});
const holdingSchema = z.object({
  instrumentId: idSchema,
  name: z.string(),
  priceCents: centsSchema,
  changePct: z.number(),
  changeCents: centsSchema,
});
export const topFlopSchema = z.object({ top: z.array(holdingSchema), flop: z.array(holdingSchema) });
