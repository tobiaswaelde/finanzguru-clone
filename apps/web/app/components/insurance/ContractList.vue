<template>
  <div class="grid gap-3 lg:grid-cols-2">
    <UCard v-for="row in contracts" :key="row.id">
      <h2 class="font-semibold">{{ row.provider }}</h2>
      <p class="text-sm text-muted">
        {{ $t(`insurance.types.${row.type}`) }} · {{ $t(`insurance.intervals.${row.interval}`) }}
      </p>
      <dl class="my-3 space-y-1 text-sm">
        <div class="flex flex-wrap justify-between gap-2">
          <dt>{{ $t('insurance.premium') }}</dt>
          <dd><Money :cents="row.premiumCents" /></dd>
        </div>
        <div class="flex flex-wrap justify-between gap-2">
          <dt>{{ $t('insurance.yearly') }}</dt>
          <dd><Money :cents="row.yearlyCostCents" /></dd>
        </div>
        <div class="flex flex-wrap justify-between gap-2">
          <dt>{{ $t('insurance.start') }}</dt>
          <dd>{{ formatDate(row.startDate) }}</dd>
        </div>
        <div v-if="row.endDate" class="flex flex-wrap justify-between gap-2">
          <dt>{{ $t('insurance.end') }}</dt>
          <dd>{{ formatDate(row.endDate) }}</dd>
        </div>
        <div v-if="row.contractNumber" class="flex flex-wrap justify-between gap-2">
          <dt>{{ $t('insurance.number') }}</dt>
          <dd class="break-all">{{ row.contractNumber }}</dd>
        </div>
      </dl>
      <p v-if="row.notes" class="mb-3 break-words text-sm">{{ row.notes }}</p>
      <div class="flex flex-wrap gap-2">
        <UButton variant="outline" size="sm" @click="emit('edit', row)">{{ $t('budget.edit') }}</UButton>
        <UButton variant="outline" size="sm" color="error" @click="emit('remove', row)">{{
          $t('budget.delete')
        }}</UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { formatDate, type insuranceContractSchema } from '@finance/shared';
import Money from '~/components/common/Money.vue';

type Contract = ReturnType<typeof insuranceContractSchema.parse>;
defineProps<{ contracts: Contract[] }>();
const emit = defineEmits<{ edit: [row: Contract]; remove: [row: Contract] }>();
</script>
