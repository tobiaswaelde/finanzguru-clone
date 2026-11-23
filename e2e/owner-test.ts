import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';

export const test = base.extend({
  /** Load the disposable owner login produced by global setup. */
  storageState: async ({ baseURL }, use) => {
    const state = process.env.PLAYWRIGHT_FINANCE_OWNER_STATE;
    if (!state || !baseURL) throw new Error('Missing synthetic owner session');
    await use(state);
  },
});
