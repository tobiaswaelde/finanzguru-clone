import { mountSuspended } from '@nuxt/test-utils/runtime';
import { expect, it } from 'vitest';
import NetWorthChart from '../app/components/dashboard/NetWorthChart.vue';

it('shows cent-exact totals and emits the selected chart mode', async () => {
  const chart = await mountSuspended(NetWorthChart, {
    props: { data: { totalCents: 6507200, gainCents: 200, gainPct: 0.04, series: [] }, period: 'ALL' },
  });
  expect(chart.text()).toContain('65.072,00\u00a0€');
  expect(chart.text()).toContain('+2,00\u00a0€');
  const returns = chart.findAll('button').find((button) => button.text() === 'Rendite');
  expect(returns).toBeDefined();
  await returns?.trigger('click');
  expect(chart.emitted('update:mode')).toEqual([['return']]);
});
