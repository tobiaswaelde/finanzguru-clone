<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">{{ $t('dashboard.review') }}</h2>
    </template>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p>{{ $t('dashboard.reviewCount', count ?? 0) }}</p>
      <UButton v-if="count" variant="outline" :to="{ path: '/budget/review', query: $route.query }">
        {{ $t('dashboard.reviewLink') }}
      </UButton>
    </div>
  </UCard>
</template>

<script setup lang="ts">
defineProps<{ count: number | null }>();
</script>
