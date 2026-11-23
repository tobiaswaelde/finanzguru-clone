import { mountSuspended } from '@nuxt/test-utils/runtime';
import { expect, it } from 'vitest';
import CashflowSummary from '../app/components/budget/CashflowSummary.vue';
import PeriodSwitcher from '../app/components/budget/PeriodSwitcher.vue';

it('steps one selected quarter back without month overflow', async () => {
  const widget = await mountSuspended(PeriodSwitcher, {
    props: { granularity: 'quarter', anchor: '2026-05-31', label: 'Q2 2026' },
  });
  await widget.get('button[aria-label="Vorheriger Zeitraum"]').trigger('click');
  expect(widget.emitted('update:anchor')).toEqual([['2026-02-01']]);
});

it('handles a missing period summary without rendering NaN', async () => {
  const widget = await mountSuspended(CashflowSummary, { props: { data: null } });
  expect(widget.text()).toContain('Sparquote');
  expect(widget.text()).not.toContain('NaN');
});
