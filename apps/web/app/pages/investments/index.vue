<template>
  <UContainer as="main" class="min-w-0 space-y-4 pb-8">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-2xl font-semibold">{{ $t('shell.investments') }}</h1>
      <UButton variant="outline" :to="{ path: '/investments/transactions', query: $route.query }">{{
        $t('investments.transactions')
      }}</UButton>
    </div>
    <p v-if="error || positionsError" role="alert" class="text-error">{{ $t('auth.unavailable') }}</p>
    <PerformanceChart v-model:period="period" v-model:unit="unit" :data="performance ?? null" />
    <div role="group" :aria-label="$t('investments.views')">
      <UButton variant="ghost" :aria-pressed="view === 'positions'" @click="view = 'positions'">{{
        $t('investments.positions')
      }}</UButton>
      <UButton variant="ghost" :aria-pressed="view === 'classes'" @click="view = 'classes'">{{
        $t('investments.assetClass')
      }}</UButton>
    </div>
    <PositionsTable
      v-if="view === 'positions'"
      v-model:asset="asset"
      :rows="rows ?? []"
      :sold="sold ?? []"
      :accounts="scope"
    />
    <AssetClassTable v-else :rows="classes ?? []" />
  </UContainer>
</template>

<script setup lang="ts">
import type {
  assetClasses,
  investmentClassesSchema,
  investmentPerformanceSchema,
  investmentPositionsSchema,
  periods,
} from '@finance/shared';
import AssetClassTable from '~/components/investments/AssetClassTable.vue';
import PerformanceChart from '~/components/investments/PerformanceChart.vue';
import PositionsTable from '~/components/investments/PositionsTable.vue';

const { accounts } = useAccountFilter();
const scope = computed(() => accounts.value.join(',') || undefined);
const { get } = useApi();
const period = ref<(typeof periods)[number]>('ALL');
const unit = ref<'eur' | 'pct'>('eur');
const view = ref<'positions' | 'classes'>('positions');
const asset = ref<(typeof assetClasses)[number]>();
const { data: performance, error } = useAsyncData(
  'investments-performance',
  () =>
    get<ReturnType<typeof investmentPerformanceSchema.parse>>('/api/investments/performance', {
      period: period.value,
      unit: unit.value,
      accounts: scope.value,
    }),
  { watch: [scope, period, unit] },
);
const { data: rows, error: positionsError } = useAsyncData(
  'investments-open',
  () =>
    get<ReturnType<typeof investmentPositionsSchema.parse>>('/api/investments/positions', {
      status: 'open',
      assetClass: asset.value,
      accounts: scope.value,
    }),
  { watch: [scope, asset] },
);
const { data: sold } = useAsyncData(
  'investments-sold',
  () =>
    get<ReturnType<typeof investmentPositionsSchema.parse>>('/api/investments/positions', {
      status: 'sold',
      assetClass: asset.value,
      accounts: scope.value,
    }),
  { watch: [scope, asset] },
);
const { data: classes } = useAsyncData(
  'investments-classes',
  () =>
    get<ReturnType<typeof investmentClassesSchema.parse>>('/api/investments/asset-classes', { accounts: scope.value }),
  { watch: [scope] },
);
</script>
