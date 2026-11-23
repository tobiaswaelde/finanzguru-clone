<template>
  <span class="tabular-nums">{{ value === null ? '–' : formatPct(value, signed) }}</span>
</template>

<script setup lang="ts">
import { formatPct } from '@finance/shared';

defineOptions({ name: 'FinancePercent' });
defineProps<{ value: number | string | null; signed?: boolean }>();
</script>
