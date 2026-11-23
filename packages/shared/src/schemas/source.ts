import { z } from 'zod';
import { sourceKinds, sourceStatuses } from '../enums.js';
import { idSchema, timestampSchema } from './common.js';

export const sourceSchema = z.object({
  id: idSchema,
  kind: z.enum(sourceKinds),
  status: z.enum(sourceStatuses),
  displayName: z.string(),
  lastSyncAt: timestampSchema.nullable(),
  lastError: z.string().nullable(),
});
