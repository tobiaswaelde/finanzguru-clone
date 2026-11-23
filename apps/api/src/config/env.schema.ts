import { Buffer } from 'node:buffer';
import { z } from 'zod';

export const apiEnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_PATH: z.string().min(1).default('./data/app.db'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  API_SESSION_SECRET: z.string().refine((value) => Buffer.byteLength(value, 'utf8') >= 32, {
    message: 'Expected at least 32 UTF-8 bytes',
  }),
  API_ENCRYPTION_KEY: z.base64().refine((value) => Buffer.from(value, 'base64').length === 32, {
    message: 'Expected a base64-encoded 32-byte key',
  }),
});

/** Validate startup settings without exposing credential values in errors. */
export function parseApiEnv(env: NodeJS.ProcessEnv): z.infer<typeof apiEnvSchema> {
  const result = apiEnvSchema.safeParse(env);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map(({ path }) => path.join('.')))].join(', ');
    throw new Error(`Invalid API environment: ${fields}`);
  }
  return result.data;
}
