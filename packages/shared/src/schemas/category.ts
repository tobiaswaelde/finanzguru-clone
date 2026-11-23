import { z } from 'zod';
import { categoryKinds } from '../enums.js';
import { idSchema } from './common.js';

export const categoryInputSchema = z.object({
  parentId: idSchema.nullable().optional(),
  name: z.string().trim().min(1),
  kind: z.enum(categoryKinds),
  color: z.string().min(1),
});

export const categorySchema = categoryInputSchema.required().extend({
  id: idSchema,
  isDefault: z.boolean(),
});

export const categoryTreeSchema = z.array(categorySchema.extend({ children: z.array(categorySchema) }));
