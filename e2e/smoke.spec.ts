import { expect, test } from '@playwright/test';

test('protects the German overview and supports login and logout', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/u);
  await page.getByLabel('Passwort').fill('playwright-demo-password');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link')).toHaveCount(4);
  await expect(page.getByLabel('Kontofilter')).toBeVisible();
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL(/\/login$/u);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/u);
});
