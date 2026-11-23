import { z } from 'zod';
import { insuranceIntervals, insuranceTypes } from '../enums.js';
import { centsSchema, dateSchema, idSchema } from './common.js';

export const insuranceShapeSchema = z.object({
  type: z.enum(insuranceTypes),
  provider: z.string().trim().min(1).max(120),
  contractNumber: z.string().trim().max(120).nullable().optional(),
  premiumCents: centsSchema.min(1).max(Math.floor(Number.MAX_SAFE_INTEGER / 12)),
  interval: z.enum(insuranceIntervals),
  startDate: dateSchema,
  endDate: dateSchema.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  linkedCategoryId: idSchema.nullable().optional(),
});
export const insuranceInputSchema = insuranceShapeSchema.refine(
  /** Refuse a contract ending before it starts. */
  ({ startDate, endDate }) => !endDate || endDate >= startDate,
  { path: ['endDate'], message: 'End date precedes start date' },
);
export const insuranceContractSchema = insuranceShapeSchema.required().extend({
  id: idSchema,
  yearlyCostCents: centsSchema,
});
export const insuranceContractsSchema = z.array(insuranceContractSchema);
