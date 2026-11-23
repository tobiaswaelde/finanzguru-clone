import { readFile } from 'node:fs/promises';
import { expect, test } from './owner-test.js';

test('imports bank CSV, skips duplicates, reports row errors, and reuses a mapping', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
  const api = page.context().request;
  const accountName = `Import ${testInfo.project.name}`;
  const created = await api.post('/api/accounts', { data: { name: accountName, type: 'checking' } });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  /** Upload a disposable synthetic file to the isolated browser test account. */
  async function upload(file: string, buffer?: Buffer) {
    await expect(page.getByRole('button', { name: 'CSV-Datei auswählen' })).toBeEnabled();
    const input = page.locator('input[type=file]');
    await input.setInputFiles({
      name: file,
      mimeType: 'text/csv',
      buffer: buffer ?? (await readFile(`apps/api/test/fixtures/csv/${file}`)),
    });
    await page.getByLabel('Zielkonto').selectOption({ label: accountName });
    await page.getByRole('button', { name: 'Vorschau anzeigen' }).click();
  }
  /** Confirm the staged preview and wait for a complete result. */
  async function confirm(expected: string) {
    await page.getByRole('button', { name: 'Import bestätigen' }).click();
    await expect(page.getByRole('status').filter({ hasText: expected })).toBeVisible();
  }
  try {
    await page.goto('/settings/sources');
    await upload('sparkasse-camt-v8.csv');
    await expect(page.getByText('Format: sparkasse-camt-v8')).toBeVisible();
    await confirm('2 neu · 0 übersprungen · 0 fehlerhaft');
    await upload('sparkasse-camt-v8.csv');
    await confirm('0 neu · 2 übersprungen · 0 fehlerhaft');
    await upload('malformed.csv');
    await confirm('0 neu · 1 übersprungen · 2 fehlerhaft');
    await expect(page.getByText('Zeile 3: Ungültiges Datum')).toBeVisible();
    const uniqueHeader = `When ${testInfo.project.name} ${testInfo.retry}`;
    const mapped = Buffer.from(`${uniqueHeader},Amount\n2026-02-04,10.00\n`);
    await upload('mapped.csv', mapped);
    await page.getByLabel('Buchungsdatum', { exact: true }).selectOption({ label: uniqueHeader });
    await page.getByLabel('Betrag', { exact: true }).selectOption({ label: 'Amount' });
    await page.getByLabel('Zuordnung speichern als').fill(`Map ${testInfo.project.name}`);
    await confirm('1 neu · 0 übersprungen · 0 fehlerhaft');
    await upload('mapped.csv', mapped);
    await expect(page.getByText('Format: generic')).toBeVisible();
    await confirm('0 neu · 1 übersprungen · 0 fehlerhaft');
    await page.goto(`/?accounts=${id}`);
    await expect(page.locator('[data-widget="networth"]')).toContainText(/984,50\s€/u);
  } finally {
    await api.delete(`/api/accounts/${id}?force=true`);
  }
});
