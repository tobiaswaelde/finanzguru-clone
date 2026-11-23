<template>
  <UCard>
    <h2 class="font-semibold">{{ source.displayName }}</h2>
    <UBadge color="neutral">{{ $t(`import.sourceStatus.${source.status}`) }}</UBadge>
    <p v-if="source.kind === 'sparkasse_fints'" class="mt-2 text-sm text-muted">
      {{ $t('import.sparkassePlanned') }}
    </p>
  </UCard>
</template>

<script setup lang="ts">
import type { sourceSchema } from '@finance/shared';
defineProps<{ source: ReturnType<typeof sourceSchema.parse> }>();
</script>
