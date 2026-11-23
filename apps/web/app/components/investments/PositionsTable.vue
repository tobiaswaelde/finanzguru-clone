<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">{{ $t('investments.positions') }}</h2>
    </template>
    <div class="flex flex-wrap items-center gap-3">
      <div role="group" class="flex flex-wrap gap-1" :aria-label="$t('investments.assetClass')">
        <UButton size="xs" :aria-pressed="!asset" @click="asset = undefined">{{ $t('investments.all') }}</UButton>
        <UButton
          v-for="item in assetClasses"
          :key="item"
          size="xs"
          :aria-pressed="asset === item"
          @click="asset = item"
          >{{ $t(`investments.classes.${item}`) }}</UButton
        >
      </div>
      <UPopover>
        <UButton variant="outline" size="xs">{{ $t('investments.columns') }}</UButton>
        <template #content>
          <div class="max-h-80 space-y-1 overflow-auto p-3">
            <UCheckbox
              v-for="key in selectable"
              :key="key"
              :label="$t(`investments.fields.${key}`)"
              :model-value="visible.includes(key)"
              @update:model-value="toggle(key, $event)"
            />
          </div>
        </template>
      </UPopover>
      <UButton v-if="rows.length" variant="outline" size="xs" :to="exportUrl" external>{{
        $t('investments.export')
      }}</UButton>
    </div>
    <p v-if="rows.length" class="mt-3 text-sm">{{ $t('investments.filteredTotal') }} <Money :cents="total" /></p>
    <div v-if="rows.length" class="mt-3 overflow-x-auto">
      <UTable :data="rows" :columns="columns">
        <template #name-cell="{ row }">
          <NuxtLink
            class="font-medium hover:underline"
            :to="{ path: `/investments/${row.original.instrumentId}`, query: $route.query }"
          >
            {{ row.original.name }}
          </NuxtLink>
        </template>
      </UTable>
    </div>
    <EmptyState v-else class="mt-3" :title="$t('common.notAvailable')" />
    <details v-if="sold.length" class="mt-5">
      <summary class="cursor-pointer font-medium">{{ $t('investments.sold') }}</summary>
      <ul class="mt-2 space-y-2">
        <li v-for="row in sold" :key="row.instrumentId" class="flex flex-wrap justify-between gap-2">
          <NuxtLink class="hover:underline" :to="{ path: `/investments/${row.instrumentId}`, query: $route.query }">{{
            row.name
          }}</NuxtLink>
          <Money signed :cents="row.realizedCents ?? null" />
        </li>
      </ul>
    </details>
  </UCard>
</template>

<script setup lang="ts">
import {
  assetClasses,
  formatEur,
  formatPct,
  investmentExportColumns,
  type investmentPositionSchema,
} from '@finance/shared';
import type { TableColumn } from '@nuxt/ui';
import EmptyState from '~/components/common/EmptyState.vue';
import Money from '~/components/common/Money.vue';

type Position = ReturnType<typeof investmentPositionSchema.parse>;
type Column = (typeof investmentExportColumns)[number];
const props = defineProps<{ rows: Position[]; sold: Position[]; accounts?: string }>();
const { t } = useI18n();
const asset = defineModel<Position['assetClass'] | undefined>('asset');
const selectable = investmentExportColumns.filter((key) => key !== 'realizedCents');
const visible = ref<Column[]>([
  'name',
  'assetClass',
  'wkn',
  'isin',
  'priceCents',
  'dayChangePct',
  'quantity',
  'valueCents',
  'entryValueCents',
  'avgPrice',
  'gainCents',
  'gainPct',
  'allocationPct',
  'dividendsCents',
]);
const total = computed(() => props.rows.reduce((sum, row) => sum + row.valueCents, 0));

/** Render a selected table cell without HTML interpolation. */
function display(key: Column, row: Position): string {
  const value = row[key];
  if (value == null) return '–';
  if (key === 'assetClass') return t(`investments.classes.${value}`);
  if (key.endsWith('Cents') && typeof value === 'number') return formatEur(value);
  if (key.endsWith('Pct') && typeof value === 'number') return formatPct(value);
  if (key === 'avgPrice' || key === 'quantity')
    return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 }).format(Number(value));
  return String(value);
}

const columns = computed<TableColumn<Position>[]>(() =>
  visible.value.map((key) => ({
    accessorKey: key,
    header: t(`investments.fields.${key}`),
    cell: ({ row }) => display(key, row.original),
  })),
);
const exportUrl = computed(() => {
  const query = new URLSearchParams({ columns: visible.value.join(',') });
  if (asset.value) query.set('assetClass', asset.value);
  if (props.accounts) query.set('accounts', props.accounts);
  return `/api/investments/positions.csv?${query}`;
});

/** Toggle a column and preserve the canonical display order. */
function toggle(key: Column, checked: boolean | 'indeterminate'): void {
  const next = new Set(visible.value);
  if (checked === true) next.add(key);
  else if (next.size > 1) next.delete(key);
  visible.value = selectable.filter((item) => next.has(item));
}
</script>
