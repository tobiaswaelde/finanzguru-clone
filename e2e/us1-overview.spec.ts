import { expect, test } from './owner-test.js';

test('shows exact demo net worth, filters accounts, and persists the customized layout', async ({ page }) => {
  await page.goto('/');
  const chart = page.locator('[data-widget="networth"]');
  await expect(chart).toContainText(/65\.072,00\s€/u);
  await expect(chart.locator('svg').first()).toBeVisible();
  await chart.getByRole('button', { name: 'Rendite' }).click();
  await expect(chart.getByRole('button', { name: 'Rendite' })).toHaveAttribute('aria-pressed', 'true');
  await chart.getByRole('button', { name: '1M', exact: true }).click();
  await expect(chart.getByRole('button', { name: '1M', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Kontofilter').click();
  await page.getByRole('option', { name: 'Demo-Girokonto' }).click();
  await page.keyboard.press('Escape');
  await expect(chart).toContainText(/63\.000,00\s€/u);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );

  const api = page.context().request;
  const original = await (await api.get('/api/dashboard/layout')).json();
  try {
    await page.getByRole('button', { name: 'Anpassen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Anpassen' });
    await dialog.getByRole('checkbox', { name: 'Kennzahlen' }).uncheck();
    await dialog.getByRole('button', { name: 'Nach unten' }).first().click();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.locator('[data-widget="kpis"]')).toHaveCount(0);
    await expect(page.locator('[data-widget]').first()).toHaveAttribute('data-widget', 'allocation');
  } finally {
    await api.put('/api/dashboard/layout', { data: original });
  }
});
