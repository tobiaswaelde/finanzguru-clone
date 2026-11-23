<template>
  <UCard>
    <template #header
      ><h2 class="font-semibold">{{ $t('dashboard.cashflow') }}</h2></template
    >
    <EmptyState :title="$t('common.notAvailable')" />
  </UCard>
</template>

<script setup lang="ts">
import EmptyState from '~/components/common/EmptyState.vue';
</script>
