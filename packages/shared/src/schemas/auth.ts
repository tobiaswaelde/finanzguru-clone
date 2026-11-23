import { z } from 'zod';
import { decimalSchema } from './common.js';

export const loginSchema = z.object({ password: z.string().min(1).max(1024) });
export const sessionSchema = z.object({ displayName: z.string() });

export const ownerSettingsSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  inflationRate: decimalSchema.max(32).refine((rate) => Number(rate) >= 0 && Number(rate) <= 0.5),
});
export const ownerSettingsPatchSchema = ownerSettingsSchema.partial().strict();
