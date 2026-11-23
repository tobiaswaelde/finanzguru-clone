<template>
  <div class="rounded-lg border border-dashed border-default p-6 text-center">
    <p class="font-medium">{{ title }}</p>
    <p v-if="description" class="mt-1 text-sm text-muted">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>
