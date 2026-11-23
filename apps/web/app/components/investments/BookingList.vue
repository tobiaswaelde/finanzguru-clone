<template>
  <UCard>
    <template #header
      ><h2 class="font-semibold">{{ $t('investments.transactions') }}</h2></template
    >
    <ul v-if="rows.length" class="divide-y divide-default">
      <li v-for="row in rows" :key="row.id" class="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
        <span
          >{{ formatDate(row.bookingDate) }} · {{ $t(`investments.bookingTypes.${row.type}`)
          }}<template v-if="row.purpose"> · {{ row.purpose }}</template></span
        >
        <Money signed :cents="row.amountCents" />
      </li>
    </ul>
    <EmptyState v-else :title="$t('common.notAvailable')" />
  </UCard>
</template>

<script setup lang="ts">
import { formatDate, type transactionSchema } from '@finance/shared';
import EmptyState from '~/components/common/EmptyState.vue';
import Money from '~/components/common/Money.vue';

defineProps<{ rows: ReturnType<typeof transactionSchema.parse>[] }>();
</script>
