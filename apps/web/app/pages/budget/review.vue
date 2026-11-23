<template>
  <UContainer as="main" class="space-y-4 pb-8">
    <NuxtLink class="text-primary" to="/budget">{{ $t('shell.budget') }}</NuxtLink>
    <h1 class="text-2xl font-semibold">{{ $t('budget.review') }}</h1>
    <p role="status">{{ $t('budget.bookingCount', { count: data?.total ?? 0 }) }}</p>
    <p v-if="error || failed" role="alert" class="text-error">{{ $t('auth.unavailable') }}</p>
    <EmptyState v-if="!data?.items.length" :title="$t('common.notAvailable')" />
    <UCard v-for="row in data?.items" :key="row.id" :data-booking="row.id">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="font-medium">{{ row.counterparty || row.purpose || $t('budget.unnamed') }}</p>
          <small class="text-muted">{{ formatDate(row.bookingDate) }}</small>
        </div>
        <Money signed :cents="row.amountCents" />
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <UCheckbox
          v-if="row.counterparty || row.purpose"
          v-model="saveRule[row.id]"
          :label="$t('budget.saveRule')"
          :disabled="pending.has(row.id) || !ready"
        />
        <USelect
          :items="options"
          :model-value="row.categoryId ?? undefined"
          :placeholder="$t('budget.chooseCategory')"
          :aria-label="$t('budget.chooseCategory')"
          :disabled="pending.has(row.id) || !ready"
          @update:model-value="categorize(row, $event)"
        />
      </div>
    </UCard>
    <UPagination v-if="data?.total" v-model:page="page" :total="data.total" :items-per-page="25" />
  </UContainer>
</template>

<script setup lang="ts">
import {
  formatDate,
  type categoryTreeSchema,
  type investmentTransactionsSchema,
  type transactionSchema,
} from '@finance/shared';
import EmptyState from '~/components/common/EmptyState.vue';
import Money from '~/components/common/Money.vue';

type Booking = ReturnType<typeof transactionSchema.parse>;
const route = useRoute();
const { accounts } = useAccountFilter();
const { get, mutate } = useApi();
const page = ref(1);
const pending = reactive(new Set<string>());
const saveRule = reactive<Record<string, boolean>>({});
const failed = ref(false);
const ready = ref(false);
onMounted(() => {
  ready.value = true;
});
const filter = computed(() => ({
  accounts: accounts.value.join(',') || undefined,
  categoryId: typeof route.query.categoryId === 'string' ? route.query.categoryId : undefined,
  from: typeof route.query.from === 'string' ? route.query.from : undefined,
  to: typeof route.query.to === 'string' ? route.query.to : undefined,
}));
watch(filter, () => {
  page.value = 1;
});
const { data, error, refresh } = useAsyncData(
  'budget-review-list',
  () =>
    get<ReturnType<typeof investmentTransactionsSchema.parse>>('/api/transactions', {
      ...filter.value,
      page: String(page.value),
      status: filter.value.categoryId ? undefined : 'unreviewed',
      uncategorized: filter.value.categoryId ? undefined : 'true',
    }),
  { watch: [filter, page] },
);
const { data: tree } = useAsyncData('budget-review-categories', () =>
  get<ReturnType<typeof categoryTreeSchema.parse>>('/api/categories'),
);
const options = computed(() =>
  (tree.value ?? []).flatMap((group) => [
    { value: group.id, label: group.name },
    ...group.children.map((child) => ({ value: child.id, label: `${group.name} › ${child.name}` })),
  ]),
);

/** Assign the selected category immediately; optionally save a matching rule in the same request. */
async function categorize(row: Booking, categoryId: string): Promise<void> {
  if (!categoryId || pending.has(row.id)) return;
  pending.add(row.id);
  failed.value = false;
  const pattern = row.counterparty || row.purpose;
  try {
    await mutate(`/api/transactions/${row.id}`, 'PATCH', {
      categoryId,
      createRule:
        saveRule[row.id] && pattern
          ? { matchField: row.counterparty ? 'counterparty' : 'purpose', operator: 'equals', pattern }
          : undefined,
    });
    await refresh();
    clearNuxtData((key) => key.startsWith('dashboard-'));
  } catch {
    failed.value = true;
  } finally {
    pending.delete(row.id);
  }
}
</script>
