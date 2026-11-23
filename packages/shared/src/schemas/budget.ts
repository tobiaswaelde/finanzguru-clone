import { z } from 'zod';
import { centsSchema, idSchema } from './common.js';

export const budgetInputSchema = z.object({
  categoryId: idSchema,
  monthlyLimitCents: centsSchema.min(1),
});
export const budgetSchema = budgetInputSchema.extend({
  id: idSchema,
  spentCents: centsSchema,
  remainingCents: centsSchema,
});
export const budgetsSchema = z.array(budgetSchema);
