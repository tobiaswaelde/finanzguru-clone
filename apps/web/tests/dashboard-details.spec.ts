import { mountSuspended } from '@nuxt/test-utils/runtime';
import { expect, it } from 'vitest';
import AccountsCard from '../app/components/dashboard/AccountsCard.vue';
import HoldingsCard from '../app/components/dashboard/HoldingsCard.vue';
import ReviewBanner from '../app/components/dashboard/ReviewBanner.vue';

it('lists nested reference accounts and identifies review work', async () => {
  const account = { id: 'one', name: 'Depot', institution: 'Demo', logoKey: null, valueCents: 100 };
  const card = await mountSuspended(AccountsCard, {
    props: {
      data: {
        groups: [
          {
            type: 'depots',
            totalCents: 200,
            items: [{ ...account, children: [{ ...account, id: 'two', name: 'Verrechnung' }] }],
          },
        ],
      },
    },
  });
  expect(card.get('summary').text()).toContain('2,00\u00a0€');
  expect(card.text()).toContain('Verrechnung');
  const banner = await mountSuspended(ReviewBanner, { props: { count: 2 } });
  expect(banner.text()).toContain('2 offene Transaktionen');
  expect(banner.get('a').attributes('href')).toBe('/budget/review');
});

it('shows holdings with their percentage change', async () => {
  const card = await mountSuspended(HoldingsCard, {
    props: {
      range: '1D',
      data: {
        top: [{ instrumentId: 'demo', name: 'Demo ETF', priceCents: 120, changePct: 0.05, changeCents: 20 }],
        flop: [],
      },
    },
  });
  expect(card.text()).toContain('Demo ETF');
  expect(card.text()).toContain('+5\u00a0%');
});
