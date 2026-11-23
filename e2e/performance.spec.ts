import { expect, test } from './owner-test.js';

test.skip(
  process.env.FINANCE_PERF !== 'true',
  'Opt-in: run with FINANCE_PERF=true against the dedicated synthetic database',
);

test('renders five years of data and imports 50,000 rows within budget', async ({ page }) => {
  test.setTimeout(75_000);
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Content Security Policy'))
      violations.push(message.text());
  });
  const renderStart = performance.now();
  const response = await page.goto('/');
  await expect(page.locator('[data-widget="networth"] svg').first()).toBeVisible({ timeout: 8_000 });
  const renderMs = performance.now() - renderStart;
  expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(violations).toEqual([]);
  const api = page.context().request;
  const health = await api.get('/api/health');
  expect(health.headers()['x-content-type-options']).toBe('nosniff');
  const account = await (await api.post('/api/accounts', { data: { type: 'checking', name: 'Perf import' } })).json();
  const day = new Date().toISOString().slice(0, 10);
  const rows = Array.from({ length: 50000 }, (_, index) => `${day},1.00,Test Vendor,Booking ${index}\n`);
  const start = performance.now();
  const preview = await api.post('/api/import/csv', {
    multipart: {
      file: {
        name: 'synthetic-performance.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(`Date,Amount,Counterparty,Purpose\n${rows.join('')}`),
      },
    },
  });
  expect(preview.status()).toBe(201);
  const { jobId } = await preview.json();
  const imported = await api.post(`/api/import/csv/${jobId}/confirm`, {
    data: {
      accountId: account.id,
      mapping: { columns: { date: 0, amount: 1, counterparty: 2, purpose: 3 } },
    },
    timeout: 35_000,
  });
  const importMs = performance.now() - start;
  expect(imported.status()).toBe(200);
  expect(await imported.json()).toMatchObject({ imported: 50000, failed: 0 });
  console.log(`Synthetic benchmark: overview ${renderMs.toFixed(0)} ms, CSV ${importMs.toFixed(0)} ms`);
  expect(renderMs).toBeLessThan(2000);
  expect(importMs).toBeLessThan(30000);
});
