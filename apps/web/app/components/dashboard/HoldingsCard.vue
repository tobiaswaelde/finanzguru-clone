<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold">{{ $t('dashboard.holdings') }}</h2>
        <label class="flex items-center gap-2">
          {{ $t('common.period') }}
          <select v-model="range" class="rounded border border-default bg-default px-2 py-1">
            <option v-for="item in ranges" :key="item" :value="item">{{ $t(`dashboard.ranges.${item}`) }}</option>
          </select>
        </label>
      </div>
    </template>
    <EmptyState v-if="!data?.top.length && !data?.flop.length" :title="$t('common.notAvailable')" />
    <div v-else class="grid gap-4 sm:grid-cols-2">
      <section v-for="kind in groups" :key="kind">
        <h3 class="mb-2 text-sm font-medium">{{ $t(`dashboard.${kind}`) }}</h3>
        <ul v-if="data?.[kind].length" class="space-y-2 text-sm">
          <li v-for="item in data[kind]" :key="item.instrumentId" class="flex flex-wrap justify-between gap-1">
            <NuxtLink class="hover:underline" :to="`/investments/${item.instrumentId}`">
              {{ item.name }}
            </NuxtLink>
            <Percent signed :value="item.changePct" />
          </li>
        </ul>
        <p v-else class="text-muted">–</p>
      </section>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { topFlopSchema } from '@finance/shared';
import EmptyState from '~/components/common/EmptyState.vue';
import Percent from '~/components/common/Percent.vue';

const ranges = ['1D', '1W', '1M', '1Y'] as const;
const groups = ['top', 'flop'] as const;
defineProps<{ data: ReturnType<typeof topFlopSchema.parse> | null }>();
const range = defineModel<(typeof ranges)[number]>('range', { required: true });
</script>
