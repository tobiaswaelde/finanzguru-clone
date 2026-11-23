<template>
  <UContainer as="main" class="space-y-4 pb-8">
    <NuxtLink class="text-primary" :to="{ path: '/investments', query: $route.query }">{{
      $t('shell.investments')
    }}</NuxtLink>
    <h1 class="text-2xl font-semibold">{{ $t('investments.transactions') }}</h1>
    <label class="grid max-w-xs gap-1">
      {{ $t('import.fields.type') }}
      <select v-model="kind" class="rounded border border-default bg-default p-2">
        <option value="">{{ $t('investments.all') }}</option>
        <option v-for="type in transactionTypes" :key="type" :value="type">
          {{ $t(`investments.bookingTypes.${type}`) }}
        </option>
      </select>
    </label>
    <p v-if="error" role="alert" class="text-error">{{ $t('auth.unavailable') }}</p>
    <BookingList :rows="data?.items ?? []" />
    <UPagination v-if="data?.total" v-model:page="page" :total="data.total" :items-per-page="25" />
  </UContainer>
</template>

<script setup lang="ts">
import { transactionTypes, type investmentTransactionsSchema } from '@finance/shared';
import BookingList from '~/components/investments/BookingList.vue';

const { accounts } = useAccountFilter();
const scope = computed(() => accounts.value.join(',') || undefined);
const { get } = useApi();
const page = ref(1);
const kind = ref<(typeof transactionTypes)[number] | ''>('');
watch([kind, scope], () => {
  page.value = 1;
});
const { data, error } = useAsyncData(
  'investment-transactions',
  () =>
    get<ReturnType<typeof investmentTransactionsSchema.parse>>('/api/investments/transactions', {
      accounts: scope.value,
      type: kind.value || undefined,
      page: String(page.value),
    }),
  { watch: [scope, page, kind] },
);
</script>
