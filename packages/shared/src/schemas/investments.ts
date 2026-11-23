import { z } from 'zod';
import { assetClasses, transactionTypes } from '../enums.js';
import { instrumentSchema } from './instrument.js';
import { transactionSchema } from './transaction.js';
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
export const investmentExportColumns = [
  'name',
  'assetClass',
  'wkn',
  'isin',
  'priceCents',
  'dayChangePct',
  'quantity',
  'valueCents',
  'entryValueCents',
  'avgPrice',
  'gainCents',
  'gainPct',
  'allocationPct',
  'dividendsCents',
  'realizedCents',
] as const;
export const investmentExportQuerySchema = investmentPositionQuerySchema.extend({
  columns: z.string().max(250).optional(),
});
export const investmentTransactionsQuerySchema = z.object({
  accounts: accountsSchema.optional(),
  type: z.enum(transactionTypes).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export const investmentTransactionsSchema = z.object({
  items: z.array(transactionSchema),
  total: z.int().nonnegative(),
});
export const investmentDetailSchema = z.object({
  instrument: instrumentSchema,
  position: investmentPositionSchema,
  series: z.array(z.object({ date: dateSchema, close: decimalSchema })),
  transactions: z.array(transactionSchema),
});
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
