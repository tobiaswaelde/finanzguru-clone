import { z } from 'zod';
import { assetClasses } from '../enums.js';
import { isValidIsin } from '../validators.js';
import { currencySchema, idSchema } from './common.js';

export const instrumentSchema = z.object({
  id: idSchema,
  isin: z
    .string()
    .regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/u)
    .refine(isValidIsin, 'Invalid ISIN'),
  wkn: z.string().length(6).nullable(),
  name: z.string().min(1),
  assetClass: z.enum(assetClasses),
  currency: currencySchema,
});
