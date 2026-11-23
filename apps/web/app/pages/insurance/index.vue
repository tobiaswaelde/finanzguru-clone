<template>
  <UContainer as="main" class="space-y-4">
    <h1>{{ $t('shell.insurance') }}</h1>
    <EmptyState :title="$t('common.notAvailable')" />
  </UContainer>
</template>

<script setup lang="ts">
import EmptyState from '~/components/common/EmptyState.vue';
</script>
