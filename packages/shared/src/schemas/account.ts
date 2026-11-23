import { z } from 'zod';
import { accountTypes } from '../enums.js';
import { isValidIban } from '../validators.js';
import { centsSchema, idSchema, timestampSchema } from './common.js';

export const accountInputSchema = z.object({
  institutionId: idSchema,
  name: z.string().trim().min(1).max(80),
  type: z.enum(accountTypes),
  iban: z.string().refine(isValidIban, 'Invalid IBAN').nullable().optional(),
  parentAccountId: idSchema.nullable().optional(),
  balanceCents: centsSchema.optional(),
  isHidden: z.boolean().optional(),
  sortOrder: z.int().optional(),
});

export const accountSchema = accountInputSchema.required().extend({
  id: idSchema,
  sourceId: idSchema.nullable(),
  lastSyncedAt: timestampSchema.nullable(),
});

export const manualAccountSchema = accountInputSchema.partial({ institutionId: true });
export const patchAccountSchema = manualAccountSchema.partial();

export const accountsListSchema = z.array(accountSchema);
const accountTreeItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  institution: z.string(),
  logoKey: z.string().nullable(),
  valueCents: centsSchema,
});
export const accountsTreeSchema = z.object({
  groups: z.array(
    z.object({
      type: z.enum(['depots', 'accounts']),
      totalCents: centsSchema,
      items: z.array(accountTreeItemSchema.extend({ children: z.array(accountTreeItemSchema).optional() })),
    }),
  ),
});
