import { z } from 'zod';
import { categorySources, reviewStatuses, transactionSources, transactionTypes } from '../enums.js';
import { centsSchema, dateSchema, decimalSchema, idSchema } from './common.js';

export const transactionInputSchema = z.object({
  accountId: idSchema,
  bookingDate: dateSchema,
  valueDate: dateSchema.nullable().optional(),
  amountCents: centsSchema,
  type: z.enum(transactionTypes),
  counterparty: z.string().nullable().optional(),
  counterpartyIban: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  instrumentId: idSchema.nullable().optional(),
  quantity: decimalSchema.nullable().optional(),
  unitPrice: decimalSchema.nullable().optional(),
  feeCents: centsSchema.optional(),
  taxCents: centsSchema.optional(),
  categoryId: idSchema.nullable().optional(),
});

export const transactionSchema = transactionInputSchema.required().extend({
  id: idSchema,
  categorySource: z.enum(categorySources).nullable(),
  reviewStatus: z.enum(reviewStatuses),
  source: z.enum(transactionSources),
  sourceRef: z.string().nullable(),
});

export const manualTransactionSchema = transactionInputSchema;
