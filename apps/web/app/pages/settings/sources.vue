<template>
  <UContainer as="main" class="space-y-5 pb-8">
    <h1 class="text-2xl font-semibold">{{ $t('import.sources') }}</h1>
    <p v-if="sourceError || accountError" role="alert" class="text-error">{{ $t('auth.unavailable') }}</p>
    <SourceCard v-for="source in sources" :key="source.id" :source="source" />
    <UCard>
      <template #header
        ><h2 class="font-semibold">{{ $t('import.title') }}</h2></template
      >
      <CsvUpload :accounts="accounts ?? []" @completed="refreshDashboard" />
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
import type { sourceSchema } from '@finance/shared';
import CsvUpload from '~/components/import/CsvUpload.vue';
import SourceCard from '~/components/import/SourceCard.vue';

const { get, accounts: loadAccounts } = useApi();
const { data: sources, error: sourceError } = useAsyncData('data-sources', () =>
  get<ReturnType<typeof sourceSchema.parse>[]>('/api/sources'),
);
const { data: accounts, error: accountError } = useAsyncData('import-account-options', loadAccounts);

/** Drop cached dashboard reads so the next overview shows the imported values. */
function refreshDashboard(): void {
  clearNuxtData((key) => key.startsWith('dashboard-'));
}
</script>
