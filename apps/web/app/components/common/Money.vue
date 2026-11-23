<template>
  <span class="tabular-nums" :class="tone">{{ text }}</span>
</template>

<script setup lang="ts">
import { formatEur } from '@finance/shared';

defineOptions({ name: 'FinanceMoney' });
const props = defineProps<{ cents: number | null; signed?: boolean }>();
const text = computed(() => (props.cents === null ? '–' : formatEur(props.cents, props.signed)));
const tone = computed(() => {
  if (!props.signed || !props.cents) return undefined;
  return props.cents > 0 ? 'text-success' : 'text-error';
});
</script>
