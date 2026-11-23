<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold">{{ $t('budget.categories') }}</h2>
        <div role="group" :aria-label="$t('budget.categories')">
          <UButton size="xs" :aria-pressed="kind === 'expense'" @click="kind = 'expense'">{{
            $t('budget.expenses')
          }}</UButton>
          <UButton size="xs" :aria-pressed="kind === 'income'" @click="kind = 'income'">{{
            $t('budget.income')
          }}</UButton>
        </div>
      </div>
    </template>
    <template v-if="data?.items.length">
      <ClientOnly>
        <VisSingleContainer :data="data.items" :height="140">
          <VisDonut :value="weight" :central-label="formatEur(data.totalCents)" />
        </VisSingleContainer>
      </ClientOnly>
      <ul class="divide-y divide-default">
        <li v-for="row in data.items" :key="row.categoryId ?? 'none'" class="py-2">
          <NuxtLink class="flex flex-wrap justify-between gap-2 hover:underline" :to="link(row.categoryId)">
            <span>{{ row.name }} ({{ row.count }})</span>
            <span><Money :cents="row.totalCents" /> · <Percent :value="row.pct" /></span>
          </NuxtLink>
          <ul v-if="row.children.length" class="ml-3 mt-1 text-sm text-muted">
            <li v-for="child in row.children" :key="child.categoryId ?? 'none'">
              <NuxtLink class="hover:underline" :to="link(child.categoryId)"
                >{{ child.name }} · <Money :cents="child.totalCents"
              /></NuxtLink>
            </li>
          </ul>
        </li>
      </ul>
    </template>
    <EmptyState v-else :title="$t('common.notAvailable')" />
  </UCard>
</template>

<script setup lang="ts">
import { formatEur, type cashflowCategoriesSchema } from '@finance/shared';
import { VisDonut, VisSingleContainer } from '@unovis/vue';
import EmptyState from '~/components/common/EmptyState.vue';
import Money from '~/components/common/Money.vue';
import Percent from '~/components/common/Percent.vue';

type Groups = ReturnType<typeof cashflowCategoriesSchema.parse>;
const props = defineProps<{ data: Groups | null; from?: string; to?: string }>();
const kind = defineModel<'income' | 'expense'>('kind', { required: true });
const route = useRoute();
/** Draw each category proportional to its volume. */
function weight(row: Groups['items'][number]): number {
  return row.totalCents;
}
/** Preserve selected account and date filters when drilling into transactions. */
function link(id: string | null) {
  return {
    path: '/budget/review',
    query: { accounts: route.query.accounts, categoryId: id ?? 'none', from: props.from, to: props.to },
  };
}
</script>
