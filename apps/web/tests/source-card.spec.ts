import { mountSuspended } from '@nuxt/test-utils/runtime';
import { expect, it } from 'vitest';
import SourceCard from '../app/components/import/SourceCard.vue';

it('identifies Sparkasse as planned and offers no way to activate it', async () => {
  const card = await mountSuspended(SourceCard, {
    props: {
      source: {
        id: 'sparkasse',
        kind: 'sparkasse_fints',
        status: 'planned',
        displayName: 'Sparkasse (Live-Abfrage)',
        lastSyncAt: null,
        lastError: null,
      },
    },
  });
  expect(card.text()).toContain('Geplant');
  expect(card.find('button').exists()).toBe(false);
});
