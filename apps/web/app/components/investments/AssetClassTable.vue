<template>
  <UCard>
    <template #header
      ><h2 class="font-semibold">{{ $t('investments.assetClass') }}</h2></template
    >
    <ul v-if="rows.length" class="divide-y divide-default">
      <li v-for="row in rows" :key="row.assetClass" class="flex flex-wrap items-center justify-between gap-3 py-3">
        <span>{{ $t(`investments.classes.${row.assetClass}`) }} ({{ row.count }})</span>
        <span class="flex gap-3"><Money :cents="row.valueCents" /><Percent :value="row.pct" /></span>
      </li>
    </ul>
    <EmptyState v-else :title="$t('common.notAvailable')" />
  </UCard>
</template>

<script setup lang="ts">
import type { investmentClassesSchema } from '@finance/shared';
import EmptyState from '~/components/common/EmptyState.vue';
import Money from '~/components/common/Money.vue';
import Percent from '~/components/common/Percent.vue';

defineProps<{ rows: ReturnType<typeof investmentClassesSchema.parse> }>();
</script>
