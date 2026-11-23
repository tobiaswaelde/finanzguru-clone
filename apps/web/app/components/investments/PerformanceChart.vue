<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-sm text-muted">{{ $t('investments.performance') }}</h2>
          <Money class="text-2xl font-semibold" :cents="data?.valueCents ?? null" />
          <Money v-if="data?.gainCents != null" class="ml-2 text-sm" signed :cents="data.gainCents" />
        </div>
        <div role="group" :aria-label="$t('dashboard.unit')">
          <UButton size="sm" :aria-pressed="unit === 'eur'" @click="unit = 'eur'">€</UButton>
          <UButton size="sm" :aria-pressed="unit === 'pct'" @click="unit = 'pct'">%</UButton>
        </div>
      </div>
    </template>
    <PeriodTabs v-model="period" />
    <div v-if="data?.series.length" class="mt-3" role="img" :aria-label="$t('investments.performance')">
      <ClientOnly>
        <VisXYContainer :data="data.series" :height="230">
          <VisLine :x="chartX" :y="[market, basis]" :color="['var(--ui-primary)', 'var(--ui-info)']" />
          <VisAxis type="x" :num-ticks="4" :tick-format="chartDay" />
          <VisAxis type="y" :num-ticks="4" :tick-format="chartY" />
        </VisXYContainer>
      </ClientOnly>
      <p class="text-sm text-muted">{{ $t('investments.chartLegend') }}</p>
    </div>
    <EmptyState v-else class="mt-3" :title="$t('common.notAvailable')" />
  </UCard>
</template>

<script setup lang="ts">
import { formatDate, formatEur, formatPct, type investmentPerformanceSchema, type periods } from '@finance/shared';
import { VisAxis, VisLine, VisXYContainer } from '@unovis/vue';
import EmptyState from '~/components/common/EmptyState.vue';
import Money from '~/components/common/Money.vue';
import PeriodTabs from '~/components/common/PeriodTabs.vue';

type Performance = ReturnType<typeof investmentPerformanceSchema.parse>;
type Point = Performance['series'][number];
defineProps<{ data: Performance | null }>();
const period = defineModel<(typeof periods)[number]>('period', { required: true });
const unit = defineModel<'eur' | 'pct'>('unit', { required: true });

/** Convert day to a temporal chart coordinate. */
function chartX(point: Point): number {
  return Date.parse(point.date);
}
/** Show market value in cents or as a change from its current cost basis. */
function market(point: Point): number {
  return unit.value === 'eur' ? point.valueCents : point.investedCents ? point.valueCents / point.investedCents - 1 : 0;
}
/** Show book value or the zero-return baseline. */
function basis(point: Point): number {
  return unit.value === 'eur' ? point.investedCents : 0;
}
/** Format a UTC axis label. */
function chartDay(value: number): string {
  return formatDate(new Date(value).toISOString().slice(0, 10));
}
/** Format the active ordinate. */
function chartY(value: number): string {
  return unit.value === 'eur' ? formatEur(value) : formatPct(value);
}
</script>
