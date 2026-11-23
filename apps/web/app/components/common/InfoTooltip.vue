<template>
  <UTooltip :text="text">
    <UButton type="button" size="xs" color="neutral" variant="ghost" icon="i-lucide-info" :aria-label="text" />
  </UTooltip>
</template>

<script setup lang="ts">
defineProps<{ text: string }>();
</script>
