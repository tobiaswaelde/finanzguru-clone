import { describe, expect, it } from 'vitest';
import { parseApiEnv } from '../../src/config/env.schema.js';

describe('API configuration', () => {
  it('validates the environment and defaults to secure cookies', () => {
    const result = parseApiEnv({
      API_SESSION_SECRET: 'synthetic-test-secret'.repeat(2),
      API_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
    });
    expect(result).toMatchObject({ PORT: 3001, COOKIE_SECURE: true });
  });
});
