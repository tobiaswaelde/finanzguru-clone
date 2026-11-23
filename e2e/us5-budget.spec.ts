import { expect, test } from './owner-test.js';

test('changes calendar periods, categorizes with a rule, and shows the saved budget on the dashboard', async ({
  page,
}, info) => {
  const api = page.context().request;
  const account = await (
    await api.post('/api/accounts', { data: { type: 'checking', name: `Budget ${info.project.name}` } })
  ).json();
  const accountQuery = `?accounts=${account.id}`;
  const today = new Date().toISOString().slice(0, 10);
  const purpose = `Budget-Probe ${info.project.name}`;
  let budgetId: string | undefined;
  try {
    for (const [type, amountCents] of [
      ['income', 50000],
      ['expense', -1000],
    ] as const) {
      const booked = await api.post('/api/transactions', {
        data: {
          type,
          amountCents,
          accountId: account.id,
          bookingDate: today,
          purpose: type === 'expense' ? purpose : 'Test-Einnahme',
        },
      });
      expect(booked.status()).toBe(201);
    }
    await page.goto(`/budget${accountQuery}`);
    await expect(page.getByText(/500,00\s€/u).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Geldflüsse' })).toBeVisible();
    await page.getByRole('button', { name: 'Quartal', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: /^Q[1-4] /u })).toBeVisible();
    await page.getByRole('button', { name: 'Jahr', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: new RegExp(`^${today.slice(0, 4)}$`, 'u') })).toBeVisible();
    await page.getByRole('button', { name: 'Vorheriger Zeitraum' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: new RegExp(`^${Number(today.slice(0, 4)) - 1}$`, 'u') }),
    ).toBeVisible();
    await page.goto(`/budget/review${accountQuery}`);
    await expect(page.getByRole('status').filter({ hasText: '2 Transaktionen' })).toBeVisible();
    const row = page.locator('[data-booking]').filter({ hasText: purpose });
    await row.getByRole('checkbox', { name: 'Regel speichern' }).check();
    await row.getByLabel('Kategorie auswählen').click();
    await page.getByRole('option', { name: 'Lebenshaltung › Lebensmittel und Getränke' }).click();
    await expect(page.getByRole('status').filter({ hasText: '1 Transaktionen' })).toBeVisible();
    expect(
      (await (await api.get('/api/rules')).json()).some((rule: { pattern: string }) => rule.pattern === purpose),
    ).toBe(true);
    await page.goto(`/budget/budgets${accountQuery}`);
    await page.getByLabel('Kategorie auswählen').click();
    await page.getByRole('option', { name: 'Lebenshaltung', exact: true }).click();
    await page.getByLabel('Monatslimit in Euro').fill('500');
    await page.getByRole('button', { name: 'Speichern' }).click();
    const card = page.getByText(/Ausgegeben:/u);
    await expect(card).toContainText(/500,00\s€/u);
    budgetId = (await (await api.get('/api/budgets')).json())[0]?.id;
    await page.goto(`/${accountQuery}`);
    await expect(page.locator('[data-widget="budgets"]')).toContainText(/Lebenshaltung/u);
    await expect(page.locator('[data-widget="budgets"]')).toContainText(/490,00\s€/u);
  } finally {
    const rules: { id: string; pattern: string }[] = await (await api.get('/api/rules')).json();
    for (const rule of rules) if (rule.pattern === purpose) await api.delete(`/api/rules/${rule.id}`);
    if (budgetId) await api.delete(`/api/budgets/${budgetId}`);
    await api.delete(`/api/accounts/${account.id}?force=true`);
  }
});
