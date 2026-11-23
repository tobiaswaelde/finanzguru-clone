import { join } from 'node:path';
import { type FullConfig, request } from '@playwright/test';

/** Store one synthetic authenticated browser state for the seeded feature tests. */
export default async function setup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  const workDir: unknown = config.metadata.workDir;
  if (!baseURL || typeof workDir !== 'string') throw new Error('Missing disposable Playwright configuration');
  const context = await request.newContext({ baseURL });
  try {
    const login = await context.post('/api/auth/login', { data: { password: 'playwright-demo-password' } });
    if (login.status() !== 204) throw new Error(`Synthetic fixture login failed (${login.status()})`);
    const path = join(workDir, 'owner.json');
    await context.storageState({ path });
    process.env.PLAYWRIGHT_FINANCE_OWNER_STATE = path;
  } finally {
    await context.dispose();
  }
}
