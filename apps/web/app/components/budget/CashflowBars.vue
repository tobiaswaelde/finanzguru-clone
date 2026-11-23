<template>
  <UCard>
    <template #header
      ><h2 class="font-semibold">{{ $t('budget.history') }}</h2></template
    >
    <ClientOnly>
      <svg aria-hidden="true" width="0" height="0" class="absolute">
        <defs>
          <pattern :id="`${patternId}-income`" width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="var(--ui-success)" />
            <path d="M0 5L5 0" stroke="var(--ui-bg)" />
          </pattern>
          <pattern :id="`${patternId}-expense`" width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="var(--ui-error)" />
            <path d="M0 5L5 0" stroke="var(--ui-bg)" />
          </pattern>
        </defs>
      </svg>
      <VisXYContainer :data="bars" :height="230">
        <VisGroupedBar :x="x" :y="[income, expenses]" :color="colors" />
        <VisAxis type="x" :num-ticks="4" :tick-format="tick" />
        <VisAxis type="y" :num-ticks="4" :tick-format="formatEur" />
      </VisXYContainer>
    </ClientOnly>
    <p class="text-sm text-muted">{{ $t('dashboard.cashflow') }} · {{ $t('budget.hatched') }}</p>
  </UCard>
</template>

<script setup lang="ts">
import { formatEur, type cashflowSummarySchema } from '@finance/shared';
import { VisAxis, VisGroupedBar, VisXYContainer } from '@unovis/vue';

type Bar = ReturnType<typeof cashflowSummarySchema.parse>['bars'][number];
const props = defineProps<{ bars: Bar[] }>();
const patternId = useId();
const colors = [
  (row: Bar) => (row.isCurrent ? `url(#${patternId}-income)` : 'var(--ui-success)'),
  (row: Bar) => (row.isCurrent ? `url(#${patternId}-expense)` : 'var(--ui-error)'),
];
/** Use the ordinal position for equally-spaced calendar buckets. */
function x(_row: Bar, index: number): number {
  return index;
}
/** Read income for the first bar. */
function income(row: Bar): number {
  return row.incomeCents;
}
/** Read expenses for the second bar. */
function expenses(row: Bar): number {
  return row.expenseCents;
}
/** Format an axis bucket using the server's locale-aware label. */
function tick(index: number): string {
  return Number.isInteger(index) ? (props.bars[index]?.label ?? '') : '';
}
</script>
