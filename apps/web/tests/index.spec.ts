import { mountSuspended } from '@nuxt/test-utils/runtime';
import { expect, it } from 'vitest';
import IndexPage from '../app/pages/index.vue';

it('renders the German label on the overview page', async () => {
  const page = await mountSuspended(IndexPage);
  expect(page.get('h1').text()).toBe('Übersicht');
});
