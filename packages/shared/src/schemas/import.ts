import { z } from 'zod';
import { idSchema, timestampSchema } from './common.js';

export const csvColumnSchema = z.object({
  date: z.int().nonnegative(),
  amount: z.int().nonnegative(),
  valueDate: z.int().nonnegative().optional(),
  counterparty: z.int().nonnegative().optional(),
  iban: z.int().nonnegative().optional(),
  purpose: z.int().nonnegative().optional(),
  isin: z.int().nonnegative().optional(),
  quantity: z.int().nonnegative().optional(),
  price: z.int().nonnegative().optional(),
  fee: z.int().nonnegative().optional(),
  tax: z.int().nonnegative().optional(),
  type: z.int().nonnegative().optional(),
});

export const csvMappingInputSchema = z.object({
  columns: csvColumnSchema,
  delimiter: z.enum([';', ',', '\t']).optional(),
  encoding: z.enum(['utf-8', 'windows-1252']).optional(),
  dateFormat: z.enum(['DD.MM.YYYY', 'DD.MM.YY', 'YYYY-MM-DD']).optional(),
  decimalSeparator: z.enum([',', '.']).optional(),
  skipRows: z.int().min(0).max(1000).optional(),
});

export const csvPreviewSchema = z.object({
  jobId: idSchema,
  detectedFormat: z.enum(['sparkasse-camt-v8', 'sparkasse-mt940', 'scalable-transactions', 'generic']).nullable(),
  needsMapping: z.boolean(),
  preview: z.array(z.array(z.string())).max(10),
  headers: z.array(z.string()),
  mapping: csvMappingInputSchema.optional(),
  accountId: idSchema.optional(),
});

export const csvConfirmSchema = z.object({
  accountId: idSchema,
  mapping: csvMappingInputSchema.optional(),
  saveMappingAs: z.string().trim().min(1).max(80).optional(),
});

export const savedCsvMappingSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(80),
    headerSignature: z.string().regex(/^[a-f0-9]{64}$/u),
    defaultAccountId: idSchema.nullable(),
  })
  .extend(csvMappingInputSchema.shape)
  .required({
    delimiter: true,
    encoding: true,
    dateFormat: true,
    decimalSeparator: true,
    skipRows: true,
  });
export const saveCsvMappingSchema = savedCsvMappingSchema.omit({ id: true });

export const importJobSchema = z.object({
  id: idSchema,
  status: z.enum(['running', 'succeeded', 'partial', 'failed']),
  imported: z.int().nonnegative(),
  skipped: z.int().nonnegative(),
  failed: z.int().nonnegative(),
  errors: z.array(z.object({ line: z.int().positive().optional(), reason: z.string().min(1) })).max(500),
  startedAt: timestampSchema,
  finishedAt: timestampSchema.nullable(),
});

export const ruleShapeSchema = z.object({
  priority: z.int().nonnegative(),
  matchField: z.enum(['counterparty', 'purpose', 'counterparty_iban']),
  operator: z.enum(['contains', 'equals', 'starts_with', 'regex']),
  pattern: z.string().min(1).max(256),
  amountSign: z.enum(['positive', 'negative']).nullable().optional(),
  categoryId: idSchema,
  enabled: z.boolean().optional(),
});
export const rulePatchSchema = ruleShapeSchema.partial();
export const ruleSchema = ruleShapeSchema.required().extend({ id: idSchema });
export const ruleInputSchema = ruleShapeSchema.refine(
  /** Reject invalid syntax when the rule uses a regular expression. */
  (rule) => {
    if (rule.operator !== 'regex') return true;
    try {
      new RegExp(rule.pattern, 'iu');
      return true;
    } catch {
      return false;
    }
  },
  { path: ['pattern'], message: 'Invalid regular expression' },
);
