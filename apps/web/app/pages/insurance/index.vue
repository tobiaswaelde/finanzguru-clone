<template>
  <UContainer as="main" class="space-y-4 pb-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold">{{ $t('shell.insurance') }}</h1>
      <UButton :disabled="!ready" @click="edit()">{{ $t('insurance.add') }}</UButton>
    </div>
    <p v-if="error" role="alert" class="text-error">{{ $t('auth.unavailable') }}</p>
    <ContractList v-if="contracts?.length" :contracts="contracts" @edit="edit" @remove="confirmDelete" />
    <EmptyState v-else :title="$t('insurance.empty')" />
    <UModal v-model:open="formOpen" :title="$t(selected ? 'insurance.edit' : 'insurance.add')">
      <template #body>
        <ContractForm
          :initial="selected"
          :categories="categories"
          :busy="busy"
          :failed="failure"
          @save="save"
          @cancel="formOpen = false"
        />
      </template>
    </UModal>
    <UModal v-model:open="deleteOpen" :title="$t('insurance.deleteTitle')">
      <template #body>
        <p>{{ $t('insurance.deletePrompt', { provider: deleting?.provider ?? '' }) }}</p>
        <p v-if="failure" role="alert" class="text-error">{{ $t('manual.failed') }}</p>
      </template>
      <template #footer>
        <UButton variant="ghost" @click="deleteOpen = false">{{ $t('dashboard.cancel') }}</UButton>
        <UButton color="error" :loading="busy" @click="remove">{{ $t('budget.delete') }}</UButton>
      </template>
    </UModal>
  </UContainer>
</template>

<script setup lang="ts">
import type {
  categoryTreeSchema,
  insuranceContractSchema,
  insuranceContractsSchema,
  insuranceInputSchema,
} from '@finance/shared';
import EmptyState from '~/components/common/EmptyState.vue';
import ContractForm from '~/components/insurance/ContractForm.vue';
import ContractList from '~/components/insurance/ContractList.vue';

type Contract = ReturnType<typeof insuranceContractSchema.parse>;
const { get, mutate } = useApi();
const { t } = useI18n();
const {
  data: contracts,
  error,
  refresh,
} = useAsyncData('insurance-contracts', () => get<ReturnType<typeof insuranceContractsSchema.parse>>('/api/insurance'));
const { data: tree } = useAsyncData('insurance-categories', () =>
  get<ReturnType<typeof categoryTreeSchema.parse>>('/api/categories'),
);
const categories = computed(() => [
  { label: t('budget.noParent'), value: 'none' },
  ...(tree.value ?? [])
    .flatMap((row) => [row, ...row.children])
    .filter((row) => row.kind === 'expense')
    .map((row) => ({ label: row.name, value: row.id })),
]);
const formOpen = ref(false);
const deleteOpen = ref(false);
const selected = ref<Contract>();
const deleting = ref<Contract>();
const busy = ref(false);
const failure = ref(false);
const ready = ref(false);
onMounted(() => {
  ready.value = true;
});

/** Open a new or existing contract editor. */
function edit(row?: Contract): void {
  selected.value = row;
  failure.value = false;
  formOpen.value = true;
}
/** Ask the owner to confirm removal. */
function confirmDelete(row: Contract): void {
  deleting.value = row;
  failure.value = false;
  deleteOpen.value = true;
}
/** Create or edit the selected contract, then refresh annual costs. */
async function save(input: ReturnType<typeof insuranceInputSchema.parse>): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  failure.value = false;
  try {
    if (selected.value) await mutate(`/api/insurance/${selected.value.id}`, 'PATCH', input);
    else await mutate('/api/insurance', 'POST', input);
    formOpen.value = false;
    await refresh();
  } catch {
    failure.value = true;
  } finally {
    busy.value = false;
  }
}
/** Remove only the contract shown in the confirmation. */
async function remove(): Promise<void> {
  if (!deleting.value || busy.value) return;
  busy.value = true;
  try {
    await mutate(`/api/insurance/${deleting.value.id}`, 'DELETE');
    deleteOpen.value = false;
    await refresh();
  } catch {
    failure.value = true;
  } finally {
    busy.value = false;
  }
}
</script>
