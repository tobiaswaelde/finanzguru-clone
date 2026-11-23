import { z } from 'zod';
import { periods } from '../enums.js';

export const idSchema = z.uuidv7();
export const dateSchema = z.iso.date();
export const timestampSchema = z.iso.datetime();
export const centsSchema = z.int();
export const decimalSchema = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u);
export const periodSchema = z.enum(periods);
export const currencySchema = z.string().regex(/^[A-Z]{3}$/u);
export const accountsSchema = z.string().refine(
  /** Accept nonempty comma-separated UUIDv7 account IDs. */
  (input) => input.split(',').every((id) => idSchema.safeParse(id).success),
  'Expected comma-separated account IDs',
);
export const periodQuerySchema = z.object({
  period: periodSchema.optional(),
  accounts: accountsSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
