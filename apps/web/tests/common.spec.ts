import { mountSuspended } from '@nuxt/test-utils/runtime';
import { expect, it } from 'vitest';
import EmptyState from '../app/components/common/EmptyState.vue';
import Money from '../app/components/common/Money.vue';
import Percent from '../app/components/common/Percent.vue';
import PeriodTabs from '../app/components/common/PeriodTabs.vue';

it('formats signed values and distinguishes missing data from zero', async () => {
  const money = await mountSuspended(Money, { props: { cents: -123, signed: true } });
  expect(money.text()).toBe('-1,23\u00a0€');
  expect(money.classes()).toContain('text-error');
  expect((await mountSuspended(Percent, { props: { value: null } })).text()).toBe('–');
  expect((await mountSuspended(EmptyState, { props: { title: 'Keine Daten' } })).text()).toBe('Keine Daten');
});

it('marks the current range and emits a changed period', async () => {
  const tabs = await mountSuspended(PeriodTabs, { props: { modelValue: '1M' } });
  const buttons = tabs.findAll('button');
  expect(buttons.find((button) => button.text() === '1M')?.attributes('aria-pressed')).toBe('true');
  await buttons.find((button) => button.text() === '1J')?.trigger('click');
  expect(tabs.emitted('update:modelValue')).toEqual([['1Y']]);
});
