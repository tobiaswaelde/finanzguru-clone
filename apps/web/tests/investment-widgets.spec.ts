import { mountSuspended } from '@nuxt/test-utils/runtime';
import { expect, it } from 'vitest';
import AssetClassTable from '../app/components/investments/AssetClassTable.vue';
import PerformanceChart from '../app/components/investments/PerformanceChart.vue';

it('formats portfolio figures and highlights asset classes', async () => {
  const chart = await mountSuspended(PerformanceChart, {
    props: { period: 'ALL', unit: 'eur', data: { valueCents: 33900, gainCents: 1900, series: [] } },
  });
  expect(chart.text()).toContain('339,00\u00a0€');
  await chart
    .findAll('button')
    .find((button) => button.text() === '%')
    ?.trigger('click');
  expect(chart.emitted('update:unit')).toEqual([['pct']]);
  const classes = await mountSuspended(AssetClassTable, {
    props: { rows: [{ assetClass: 'etf', valueCents: 20000, pct: 0.5, count: 3 }] },
  });
  expect(classes.text()).toContain('ETF (3)');
  expect(classes.text()).toContain('50\u00a0%');
});
