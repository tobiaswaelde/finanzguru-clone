import { mountSuspended } from '@nuxt/test-utils/runtime';
import { expect, it } from 'vitest';
import AllocationCard from '../app/components/dashboard/AllocationCard.vue';
import KpiCard from '../app/components/dashboard/KpiCard.vue';

it('shows localized allocation values and emits a unit change', async () => {
  const card = await mountSuspended(AllocationCard, {
    props: {
      data: { totalCents: 10000, slices: [{ key: 'etf', label: 'ETF', count: 1, valueCents: 5000, pct: 0.5 }] },
    },
    global: { stubs: { ClientOnly: true } },
  });
  expect(card.text()).toContain('50,00\u00a0€');
  await card
    .findAll('button')
    .find((button) => button.text() === '%')
    ?.trigger('click');
  expect(card.emitted('update:unit')).toEqual([['pct']]);
});

it('presents an explicit empty KPI state', async () => {
  const card = await mountSuspended(KpiCard, { props: { data: null, period: '1M' } });
  expect(card.text()).toContain('Hier sind noch keine Daten verfügbar.');
  expect(card.find('dl').exists()).toBe(false);
});
