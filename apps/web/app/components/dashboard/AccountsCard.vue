<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">{{ $t('dashboard.accounts') }}</h2>
    </template>
    <EmptyState v-if="groups.length === 0" :title="$t('common.notAvailable')" />
    <details v-for="group in groups" :key="group.type" open class="py-2">
      <summary class="cursor-pointer">
        <span class="inline-flex flex-wrap gap-2">
          {{ $t(`dashboard.accountGroups.${group.type}`) }} <Money :cents="group.totalCents" />
        </span>
      </summary>
      <ul class="mt-2 space-y-2">
        <li v-for="item in group.items" :key="item.id">
          <div class="flex flex-wrap justify-between gap-1">
            <span
              >{{ item.name }} <small class="text-muted">({{ item.institution }})</small></span
            >
            <Money :cents="item.valueCents" />
          </div>
          <ul v-if="item.children?.length" class="ml-4 mt-1 space-y-1 text-sm">
            <li v-for="child in item.children" :key="child.id" class="flex flex-wrap justify-between gap-1">
              {{ child.name }} <Money :cents="child.valueCents" />
            </li>
          </ul>
        </li>
      </ul>
    </details>
  </UCard>
</template>

<script setup lang="ts">
import type { accountsTreeSchema } from '@finance/shared';
import EmptyState from '~/components/common/EmptyState.vue';
import Money from '~/components/common/Money.vue';

const props = defineProps<{ data: ReturnType<typeof accountsTreeSchema.parse> | null }>();
const groups = computed(() => props.data?.groups.filter((item) => item.items.length > 0) ?? []);
</script>
