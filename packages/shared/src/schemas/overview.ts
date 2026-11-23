import { z } from 'zod';
import { centsSchema, dateSchema, periodQuerySchema } from './common.js';

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
