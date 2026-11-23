import { mountSuspended } from '@nuxt/test-utils/runtime';
import { expect, it } from 'vitest';
import ColumnMapper from '../app/components/import/ColumnMapper.vue';
import ImportResult from '../app/components/import/ImportResult.vue';

it('emits a valid column mapping only after both required columns are selected', async () => {
  const mapper = await mountSuspended(ColumnMapper, {
    props: { headers: ['When', 'Value'], preview: [['2026-01-01', '1.23']], needsMapping: true },
  });
  expect(mapper.text()).toContain('2026-01-01');
  const selectors = mapper.findAll('select');
  await selectors[0]?.setValue('0');
  await selectors[1]?.setValue('1');
  expect(mapper.emitted('update:mapping')?.at(-1)?.[0]).toMatchObject({ columns: { date: 0, amount: 1 } });
});

it('reports partial results with counts and localized physical line errors', async () => {
  const result = await mountSuspended(ImportResult, {
    props: {
      job: {
        id: 'job',
        status: 'partial',
        imported: 2,
        skipped: 1,
        failed: 1,
        errors: [{ line: 4, reason: 'invalid_amount' }],
        startedAt: '2026-01-01',
        finishedAt: '2026-01-01',
      },
    },
  });
  expect(result.text()).toContain('2 neu · 1 übersprungen · 1 fehlerhaft');
  expect(result.text()).toContain('Zeile 4: Ungültiger Betrag');
});
