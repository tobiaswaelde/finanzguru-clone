<template>
  <UContainer as="main" class="min-w-0 space-y-4 pb-8">
    <h1 class="text-2xl font-semibold">{{ $t('shell.budget') }}</h1>
    <div class="flex flex-wrap gap-2">
      <UButton variant="outline" :to="{ path: '/budget/review', query: { accounts: scope } }">{{
        $t('budget.review')
      }}</UButton>
      <UButton variant="outline" :to="{ path: '/budget/budgets', query: { accounts: scope } }">{{
        $t('dashboard.budgets')
      }}</UButton>
      <UButton variant="outline" to="/settings/categories">{{ $t('budget.categories') }}</UButton>
    </div>
    <PeriodSwitcher v-model:anchor="anchor" v-model:granularity="granularity" :label="summary?.period.label ?? ''" />
    <p v-if="summaryError || sankeyError || categoryError" role="alert" class="text-error">
      {{ $t('auth.unavailable') }}
    </p>
    <CashflowSummary :data="summary ?? null" />
    <CashflowBars v-if="summary" :bars="summary.bars" />
    <div class="grid min-w-0 gap-4 lg:grid-cols-2">
      <SankeyChart :graph="sankey ?? null" />
      <CategoryList
        v-model:kind="kind"
        :data="categories ?? null"
        :from="summary?.period.from"
        :to="summary?.period.to"
      />
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import type { cashflowCategoriesSchema, cashflowSankeySchema, cashflowSummarySchema } from '@finance/shared';
import CashflowBars from '~/components/budget/CashflowBars.vue';
import CashflowSummary from '~/components/budget/CashflowSummary.vue';
import CategoryList from '~/components/budget/CategoryList.vue';
import PeriodSwitcher from '~/components/budget/PeriodSwitcher.vue';
import SankeyChart from '~/components/budget/SankeyChart.vue';

const { get } = useApi();
const { accounts } = useAccountFilter();
const scope = computed(() => accounts.value.join(',') || undefined);
const anchor = ref(new Date().toISOString().slice(0, 10));
const granularity = ref<'month' | 'quarter' | 'year'>('month');
const kind = ref<'income' | 'expense'>('expense');
const query = computed(() => ({ accounts: scope.value, anchor: anchor.value, granularity: granularity.value }));
const { data: summary, error: summaryError } = useAsyncData(
  'budget-summary',
  () => get<ReturnType<typeof cashflowSummarySchema.parse>>('/api/cashflow/summary', query.value),
  { watch: [query] },
);
const { data: sankey, error: sankeyError } = useAsyncData(
  'budget-sankey',
  () => get<ReturnType<typeof cashflowSankeySchema.parse>>('/api/cashflow/sankey', query.value),
  { watch: [query] },
);
const { data: categories, error: categoryError } = useAsyncData(
  'budget-category-totals',
  () =>
    get<ReturnType<typeof cashflowCategoriesSchema.parse>>('/api/cashflow/categories', {
      ...query.value,
      kind: kind.value,
    }),
  { watch: [query, kind] },
);
</script>
