<template>
  <UCard>
    <template #header
      ><h2 class="font-semibold">{{ $t('dashboard.cashflow') }}</h2></template
    >
    <dl v-if="data && (data.incomeCents || data.expenseCents || data.savedCents)" class="space-y-2 text-sm">
      <div class="flex justify-between gap-2">
        <dt>{{ $t('budget.income') }}</dt>
        <dd><Money :cents="data.incomeCents" /></dd>
      </div>
      <div class="flex justify-between gap-2">
        <dt>{{ $t('budget.expenses') }}</dt>
        <dd><Money :cents="data.expenseCents" /></dd>
      </div>
    </dl>
    <EmptyState v-else :title="$t('common.notAvailable')" />
  </UCard>
</template>

<script setup lang="ts">
import type { cashflowSummarySchema } from '@finance/shared';
import EmptyState from '~/components/common/EmptyState.vue';
import Money from '~/components/common/Money.vue';

defineProps<{ data?: ReturnType<typeof cashflowSummarySchema.parse> }>();
</script>
