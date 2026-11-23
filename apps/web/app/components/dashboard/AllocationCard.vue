<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold">{{ $t('dashboard.allocation') }}</h2>
        <div role="group" :aria-label="$t('dashboard.unit')">
          <UButton size="sm" :aria-pressed="unit === 'eur'" @click="unit = 'eur'">€</UButton>
          <UButton size="sm" :aria-pressed="unit === 'pct'" @click="unit = 'pct'">%</UButton>
        </div>
      </div>
    </template>
    <template v-if="slices.length">
      <ClientOnly>
        <VisSingleContainer :data="positiveSlices" :height="185">
          <VisDonut :value="sliceValue" :color="sliceColor" :central-label="formatEur(data?.totalCents ?? 0)" />
        </VisSingleContainer>
      </ClientOnly>
      <ul class="space-y-2">
        <li v-for="slice in slices" :key="slice.key" class="flex justify-between gap-2">
          <span>{{ slice.label }} ({{ slice.count }})</span>
          <Money v-if="unit === 'eur'" :cents="slice.valueCents" />
          <Percent v-else :value="slice.pct" />
        </li>
      </ul>
    </template>
    <EmptyState v-else :title="$t('common.notAvailable')" />
  </UCard>
</template>

<script setup lang="ts">
import { formatEur, type allocationSchema } from '@finance/shared';
import { VisDonut, VisSingleContainer } from '@unovis/vue';
import EmptyState from '~/components/common/EmptyState.vue';
import Money from '~/components/common/Money.vue';
import Percent from '~/components/common/Percent.vue';

type Allocation = ReturnType<typeof allocationSchema.parse>;
type Slice = Allocation['slices'][number];
const props = defineProps<{ data: Allocation | null }>();
const unit = defineModel<'eur' | 'pct'>('unit', { default: 'eur' });
const slices = computed(() => props.data?.slices ?? []);
const positiveSlices = computed(() => slices.value.filter((slice) => slice.valueCents > 0));
const colors = ['var(--ui-primary)', 'var(--ui-secondary)', 'var(--ui-info)', 'var(--ui-warning)', 'var(--ui-success)'];

/** Draw area proportional to the positive euro amount. */
function sliceValue(slice: Slice): number {
  return slice.valueCents;
}

/** Assign a stable palette color for the displayed segment index. */
function sliceColor(_slice: Slice, index: number): string {
  return colors[index % colors.length] ?? 'var(--ui-primary)';
}
</script>
