import { z } from 'zod';
import { assetClasses } from '../enums.js';
import { accountsSchema, centsSchema, dateSchema, decimalSchema, idSchema, periodQuerySchema } from './common.js';

export const investmentPositionQuerySchema = z.object({
  accounts: accountsSchema.optional(),
  assetClass: z.enum(assetClasses).optional(),
  status: z.enum(['open', 'sold']).default('open'),
});
export const investmentPerformanceQuerySchema = periodQuerySchema.extend({
  unit: z.enum(['eur', 'pct']).default('eur'),
});
export const investmentPositionSchema = z.object({
  instrumentId: idSchema,
  name: z.string(),
  assetClass: z.enum(assetClasses),
  wkn: z.string().nullable(),
  isin: z.string(),
  priceCents: centsSchema.nullable(),
  dayChangePct: z.number().nullable(),
  quantity: decimalSchema,
  valueCents: centsSchema,
  entryValueCents: centsSchema,
  avgPrice: decimalSchema.nullable(),
  gainCents: centsSchema,
  gainPct: z.number().nullable(),
  allocationPct: z.number().nullable(),
  dividendsCents: centsSchema,
  realizedCents: centsSchema.optional(),
});
export const investmentPositionsSchema = z.array(investmentPositionSchema);
export const investmentPerformanceSchema = z.object({
  valueCents: centsSchema.nullable(),
  gainCents: centsSchema.nullable(),
  series: z.array(z.object({ date: dateSchema, valueCents: centsSchema, investedCents: centsSchema })).max(400),
});
export const investmentClassesSchema = z.array(
  z.object({
    assetClass: z.enum(assetClasses),
    valueCents: centsSchema,
    pct: z.number().nullable(),
    count: z.int().nonnegative(),
  }),
);
