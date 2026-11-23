import { z } from 'zod';
import { reviewStatuses, transactionTypes } from '../enums.js';
import { accountsSchema, centsSchema, dateSchema, idSchema } from './common.js';

export const cashflowQuerySchema = z.object({
  accounts: accountsSchema.optional(),
  anchor: dateSchema.optional(),
  granularity: z.enum(['month', 'quarter', 'year']).default('month'),
});
export const cashflowSummarySchema = z.object({
  period: z.object({ from: dateSchema, to: dateSchema, label: z.string() }),
  incomeCents: centsSchema,
  expenseCents: centsSchema,
  balanceCents: centsSchema,
  savedCents: centsSchema,
  savingsRate: z.number().nullable(),
  bars: z
    .array(
      z.object({
        label: z.string(),
        from: dateSchema,
        incomeCents: centsSchema,
        expenseCents: centsSchema,
        isCurrent: z.boolean(),
      }),
    )
    .length(12),
});
export const cashflowSankeySchema = z.object({
  nodes: z.array(z.object({ id: z.string(), label: z.string(), kind: z.string() })),
  links: z.array(z.object({ source: z.string(), target: z.string(), valueCents: centsSchema })),
});
const categoryAmount = z.object({
  categoryId: idSchema.nullable(),
  name: z.string(),
  color: z.string(),
  count: z.int().nonnegative(),
  totalCents: centsSchema,
  pct: z.number().nullable(),
});
export const cashflowCategoriesSchema = z.object({
  totalCents: centsSchema,
  count: z.int().nonnegative(),
  items: z.array(categoryAmount.extend({ children: z.array(categoryAmount) })),
});
export const transactionListQuerySchema = z.object({
  accounts: accountsSchema.optional(),
  categoryId: z.union([idSchema, z.literal('none')]).optional(),
  status: z.enum(reviewStatuses).optional(),
  uncategorized: z.enum(['true', 'false']).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export const transactionReviewSchema = z.object({
  categoryId: idSchema.nullable().optional(),
  reviewStatus: z.enum(reviewStatuses).optional(),
  type: z.enum(transactionTypes).optional(),
  createRule: z
    .object({
      matchField: z.enum(['counterparty', 'purpose', 'counterparty_iban']),
      operator: z.enum(['contains', 'equals', 'starts_with', 'regex']),
      pattern: z.string().trim().min(1).max(256),
    })
    .optional(),
});
