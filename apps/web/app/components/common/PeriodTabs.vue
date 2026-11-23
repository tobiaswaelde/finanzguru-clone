<template>
  <div role="group" class="flex flex-wrap gap-1" :aria-label="$t('common.period')">
    <UButton
      v-for="period in periods"
      :key="period"
      size="sm"
      :variant="model === period ? 'solid' : 'ghost'"
      :aria-pressed="model === period"
      @click="model = period"
    >
      {{ $t(`common.periods.${period}`) }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { periods } from '@finance/shared';

const model = defineModel<(typeof periods)[number]>({ required: true });
</script>
