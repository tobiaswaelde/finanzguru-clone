import { expect, test } from '@playwright/test';

test('serves the German overview', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link')).toHaveCount(4);
  await expect(page.getByLabel('Kontofilter')).toBeVisible();
});
