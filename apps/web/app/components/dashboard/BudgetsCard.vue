<template>
  <UCard>
    <template #header
      ><h2 class="font-semibold">{{ $t('dashboard.budgets') }}</h2></template
    >
    <ul v-if="data?.length" class="space-y-3">
      <li v-for="row in data" :key="row.id">
        <p class="font-medium">{{ names?.[row.categoryId] ?? $t('budget.categories') }}</p>
        <p class="text-sm">
          {{ $t('budget.spent') }} <Money :cents="row.spentCents" /> / <Money :cents="row.monthlyLimitCents" /> ·
          {{ $t('budget.remaining') }} <Money :cents="row.remainingCents" />
        </p>
      </li>
    </ul>
    <EmptyState v-else :title="$t('common.notAvailable')">
      <UButton class="mt-2" to="/budget/budgets">{{ $t('budget.createBudgets') }}</UButton>
    </EmptyState>
  </UCard>
</template>

<script setup lang="ts">
import type { budgetsSchema } from '@finance/shared';
import EmptyState from '~/components/common/EmptyState.vue';
import Money from '~/components/common/Money.vue';

defineProps<{ data?: ReturnType<typeof budgetsSchema.parse>; names?: Record<string, string> }>();
</script>
