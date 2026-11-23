<template>
  <UContainer as="main" class="space-y-4 pb-8">
    <NuxtLink class="text-primary" :to="{ path: '/investments', query: $route.query }">{{
      $t('shell.investments')
    }}</NuxtLink>
    <h1 class="text-2xl font-semibold">{{ detail?.instrument.name ?? $t('investments.detail') }}</h1>
    <p v-if="error" role="alert" class="text-error">{{ $t('investments.unavailable') }}</p>
    <template v-if="detail">
      <p class="text-muted">{{ detail.instrument.isin }}</p>
      <PerformanceChart v-model:period="period" v-model:unit="unit" :data="summary" />
      <BookingList :rows="detail.transactions" />
    </template>
  </UContainer>
</template>

<script setup lang="ts">
import type { investmentDetailSchema, periods } from '@finance/shared';
import BookingList from '~/components/investments/BookingList.vue';
import PerformanceChart from '~/components/investments/PerformanceChart.vue';

const route = useRoute();
const { accounts } = useAccountFilter();
const { get } = useApi();
const period = ref<(typeof periods)[number]>('ALL');
const unit = ref<'eur' | 'pct'>('eur');
const id = computed(() => String(route.params.instrumentId));
const scope = computed(() => accounts.value.join(',') || undefined);
const { data: detail, error } = useAsyncData(
  'investment-detail',
  () =>
    get<ReturnType<typeof investmentDetailSchema.parse>>(
      `/api/investments/instruments/${encodeURIComponent(id.value)}`,
      { accounts: scope.value, period: period.value },
    ),
  { watch: [id, period, scope] },
);
const summary = computed(() => {
  const current = detail.value;
  if (!current) return null;
  return {
    valueCents: current.position.priceCents,
    gainCents: current.position.gainCents,
    series: current.series.map((point) => ({
      date: point.date,
      valueCents: Math.round(Number(point.close) * 100),
      investedCents: Math.round(Number(current.position.avgPrice ?? point.close) * 100),
    })),
  };
});
</script>
