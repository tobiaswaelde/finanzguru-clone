<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm text-muted">{{ $t('dashboard.netWorth') }}</h2>
          <Money class="text-3xl font-semibold" :cents="data?.totalCents ?? null" />
          <p v-if="data?.gainCents != null" class="mt-1 flex items-center gap-2 text-sm">
            {{ $t('dashboard.gain') }}
            <Money signed :cents="data.gainCents" />
            <Percent signed :value="data.gainPct" />
          </p>
        </div>
        <div role="group" class="flex flex-wrap gap-2" :aria-label="$t('dashboard.seriesMode')">
          <UButton
            v-for="item in modes"
            :key="item"
            size="sm"
            :variant="mode === item ? 'solid' : 'ghost'"
            :aria-pressed="mode === item"
            @click="mode = item"
          >
            {{ $t(`dashboard.${item}`) }}
          </UButton>
        </div>
      </div>
    </template>
    <PeriodTabs v-model="period" />
    <div v-if="points.length" class="mt-4 min-w-0" role="img" :aria-label="$t('dashboard.netWorth')">
      <ClientOnly>
        <VisXYContainer :data="points" :height="255" :margin="{ left: 6, right: 12 }">
          <VisArea color="var(--ui-primary)" :x="x" :y="y" />
          <VisLine color="var(--ui-primary)" :x="x" :y="y" />
          <VisAxis type="x" :num-ticks="4" :tick-format="axisDate" />
          <VisAxis type="y" :num-ticks="4" :tick-format="axisValue" />
          <VisTooltip />
          <VisCrosshair :template="tooltip" />
        </VisXYContainer>
      </ClientOnly>
    </div>
    <EmptyState v-else class="mt-4" :title="$t('common.notAvailable')" />
  </UCard>
</template>

<script setup lang="ts">
import { formatDate, formatEur, formatPct, type netWorthSchema, type periods } from '@finance/shared';
import { VisArea, VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue';
import EmptyState from '~/components/common/EmptyState.vue';
import Money from '~/components/common/Money.vue';
import Percent from '~/components/common/Percent.vue';
import PeriodTabs from '~/components/common/PeriodTabs.vue';

type NetWorth = ReturnType<typeof netWorthSchema.parse>;
type Point = NetWorth['series'][number];
const modes = ['value', 'return'] as const;
const props = defineProps<{ data: NetWorth | null }>();
const mode = defineModel<(typeof modes)[number]>('mode', { default: 'value' });
const period = defineModel<(typeof periods)[number]>('period', { required: true });
const { t } = useI18n();
const points = computed(() => {
  const rows = props.data?.series ?? [];
  return mode.value === 'return' ? rows.filter((row) => row.returnPct !== null) : rows;
});

/** Convert an ISO day to a chart time coordinate. */
function x(point: Point): number {
  return Date.parse(point.date);
}

/** Convert a point to cents or a decimal ratio based on the active view. */
function y(point: Point): number {
  return mode.value === 'return' ? (point.returnPct ?? 0) : point.valueCents;
}

/** Render a UTC chart tick in the UI locale. */
function axisDate(value: number): string {
  return formatDate(new Date(value).toISOString().slice(0, 10));
}

/** Render the vertical scale in the active unit. */
function axisValue(value: number): string {
  return mode.value === 'return' ? formatPct(value) : formatEur(value);
}

/** Render only fixed translations and formatted numbers in the crosshair tooltip. */
function tooltip(point: Point): string {
  return `<strong>${formatDate(point.date)}</strong><br>${t('dashboard.netWorth')}: ${formatEur(point.valueCents)}<br>${t('dashboard.invested')}: ${formatEur(point.investedCents)}<br>${t('dashboard.cash')}: ${formatEur(point.cashCents)}`;
}
</script>
