import { expect, test } from './owner-test.js';

test('adds, edits, and confirms deletion of a contract with an exact annual premium', async ({ page }, info) => {
  const provider = `Versicherungsprobe ${info.project.name}`;
  await page.goto('/insurance');
  await page.getByRole('button', { name: 'Versicherung hinzufügen' }).click();
  const create = page.getByRole('dialog', { name: 'Versicherung hinzufügen' });
  await create.getByLabel('Anbieter').fill(provider);
  await create.getByLabel('Beitrag in Euro').fill('23,62');
  await create.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { name: provider })).toBeVisible();
  await expect(page.getByText(/283,44\s€/u)).toBeVisible();
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  const edit = page.getByRole('dialog', { name: 'Versicherung bearbeiten' });
  await edit.getByLabel('Beitrag in Euro').fill('25,00');
  await edit.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText(/300,00\s€/u)).toBeVisible();
  await page.getByRole('button', { name: 'Löschen' }).click();
  await page.getByRole('dialog', { name: 'Versicherung löschen?' }).getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('heading', { name: provider })).toHaveCount(0);
});
