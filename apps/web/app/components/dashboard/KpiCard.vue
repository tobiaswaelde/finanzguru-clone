<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">{{ $t('dashboard.kpis') }}</h2>
    </template>
    <PeriodTabs v-model="period" />
    <dl v-if="data?.investedCents != null" class="mt-4 divide-y divide-default">
      <div v-for="row in rows" :key="row.key" class="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
        <dt class="inline-flex items-center gap-1">
          {{ $t(`dashboard.metrics.${row.key}`) }}
          <InfoTooltip
            v-if="row.key === 'twror' || row.key === 'irr'"
            :text="$t(`dashboard.explanations.${row.key}`)"
          />
        </dt>
        <dd class="flex items-center gap-2">
          <Money v-if="row.cents !== undefined" signed :cents="row.cents" />
          <Percent v-if="row.pct !== undefined" signed :value="row.pct" />
        </dd>
      </div>
    </dl>
    <EmptyState v-else class="mt-4" :title="$t('common.notAvailable')" />
  </UCard>
</template>

<script setup lang="ts">
import type { kpisSchema, periods } from '@finance/shared';
import EmptyState from '~/components/common/EmptyState.vue';
import InfoTooltip from '~/components/common/InfoTooltip.vue';
import Money from '~/components/common/Money.vue';
import Percent from '~/components/common/Percent.vue';
import PeriodTabs from '~/components/common/PeriodTabs.vue';

const props = defineProps<{ data: ReturnType<typeof kpisSchema.parse> | null }>();
const period = defineModel<(typeof periods)[number]>('period', { required: true });
const rows = computed<{ key: string; cents?: number | null; pct?: number | string | null }[]>(() => {
  const data = props.data;
  if (!data) return [];
  return [
    { key: 'invested', cents: data.investedCents },
    { key: 'priceGain', cents: data.priceGain.cents, pct: data.priceGain.pct },
    { key: 'realizedGross', cents: data.realized.grossCents },
    { key: 'realizedNet', cents: data.realized.netCents, pct: data.realized.pct },
    { key: 'other', cents: data.otherGainsCents },
    { key: 'dividendsGross', cents: data.dividends.grossCents },
    { key: 'dividendsNet', cents: data.dividends.netCents },
    { key: 'interestGross', cents: data.interest.grossCents },
    { key: 'interestNet', cents: data.interest.netCents },
    { key: 'taxesFees', cents: data.taxesFeesCents },
    { key: 'total', cents: data.totalReturnCents },
    { key: 'twror', pct: data.twror },
    { key: 'irr', pct: data.irr },
    { key: 'inflation', pct: data.inflation },
    { key: 'realReturn', pct: data.realReturn },
  ];
});
</script>
