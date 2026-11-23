<template>
  <div class="flex flex-wrap items-center gap-2" role="group" :aria-label="$t('common.period')">
    <UButton
      v-for="item in widths"
      :key="item"
      size="sm"
      :disabled="!ready"
      :aria-pressed="granularity === item"
      @click="granularity = item"
      >{{ $t(`budget.granularity.${item}`) }}</UButton
    >
    <UButton size="sm" variant="outline" :aria-label="$t('budget.previous')" @click="step(-1)">‹</UButton>
    <output class="text-sm">{{ label }}</output>
    <UButton size="sm" variant="outline" :aria-label="$t('budget.next')" @click="step(1)">›</UButton>
    <UButton size="sm" variant="ghost" @click="anchor = today()">{{ $t('budget.current') }}</UButton>
  </div>
</template>

<script setup lang="ts">
const widths = ['month', 'quarter', 'year'] as const;
const granularity = defineModel<(typeof widths)[number]>('granularity', { required: true });
const anchor = defineModel<string>('anchor', { required: true });
const ready = ref(false);
onMounted(() => {
  ready.value = true;
});
defineProps<{ label: string }>();

/** Return the current UTC day, matching the budget API. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Step by one complete calendar bucket without overflowing a short month. */
function step(direction: number): void {
  const date = new Date(`${anchor.value}T00:00:00Z`);
  const months = granularity.value === 'year' ? 12 : granularity.value === 'quarter' ? 3 : 1;
  date.setUTCMonth(date.getUTCMonth() + direction * months, 1);
  anchor.value = date.toISOString().slice(0, 10);
}
</script>
