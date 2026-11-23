import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { expect, it, vi } from 'vitest';
import ManualEntry from '../app/components/import/ManualEntry.vue';

const { createAccount } = vi.hoisted(() => ({ createAccount: vi.fn() }));
mockNuxtImport('useApi', () => () => ({ createAccount, createTransaction: vi.fn() }));

it('submits a signed German amount as integer cents and reports completion', async () => {
  createAccount.mockResolvedValue({});
  const form = await mountSuspended(ManualEntry, { props: { kind: 'account', accounts: [] } });
  const fields = form.findAll('input');
  await fields[0]?.setValue('Testkonto');
  await fields[1]?.setValue('-12,30');
  await form.get('form').trigger('submit');
  await vi.waitFor(() => expect(form.emitted('completed')).toHaveLength(1));
  expect(createAccount).toHaveBeenCalledWith({ name: 'Testkonto', type: 'checking', balanceCents: -1230 });
});
