<template>
  <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
    <UCard v-for="item in items" :key="item.key">
      <h3 class="text-sm text-muted">{{ $t(`budget.${item.key}`) }}</h3>
      <Percent v-if="item.key === 'rate'" class="text-lg font-semibold" :value="data?.savingsRate ?? null" />
      <Money v-else class="text-lg font-semibold" :cents="item.value" />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { cashflowSummarySchema } from '@finance/shared';
import Money from '~/components/common/Money.vue';
import Percent from '~/components/common/Percent.vue';

const props = defineProps<{ data: ReturnType<typeof cashflowSummarySchema.parse> | null }>();
const items = computed(() => [
  { key: 'income', value: props.data?.incomeCents ?? null },
  { key: 'expenses', value: props.data?.expenseCents ?? null },
  { key: 'balance', value: props.data?.balanceCents ?? null },
  { key: 'saved', value: props.data?.savedCents ?? null },
  { key: 'rate', value: null },
]);
</script>
