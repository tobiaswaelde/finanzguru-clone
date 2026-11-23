<template>
  <UContainer as="main" class="space-y-4 pb-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold">{{ $t('overview.title') }}</h1>
      <UModal v-model:open="editing" :title="$t('dashboard.customize')">
        <UButton color="neutral" variant="outline" @click="startEditing">{{ $t('dashboard.customize') }}</UButton>
        <template #body>
          <ol class="space-y-2">
            <li v-for="(item, index) in draft" :key="item.widgetKey" class="flex flex-wrap items-center gap-2">
              <label class="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <UCheckbox v-model="item.visible" />
                {{ $t(`dashboard.widgets.${item.widgetKey}`) }}
              </label>
              <UButton
                type="button"
                size="xs"
                :disabled="index === 0"
                :aria-label="$t('dashboard.moveUp')"
                @click="move(index, -1)"
                >↑</UButton
              >
              <UButton
                type="button"
                size="xs"
                :disabled="index === draft.length - 1"
                :aria-label="$t('dashboard.moveDown')"
                @click="move(index, 1)"
                >↓</UButton
              >
            </li>
          </ol>
          <p v-if="saveFailed" role="alert" class="mt-3 text-error">{{ $t('auth.unavailable') }}</p>
        </template>
        <template #footer>
          <UButton color="neutral" variant="ghost" @click="editing = false">{{ $t('dashboard.cancel') }}</UButton>
          <UButton :loading="saving" @click="saveLayout">{{ $t('dashboard.save') }}</UButton>
        </template>
      </UModal>
    </div>
    <p v-if="dashboardFailed" role="alert" class="text-sm text-error">{{ $t('auth.unavailable') }}</p>
    <div class="grid min-w-0 gap-4 lg:grid-cols-2">
      <section
        v-for="widget in visibleWidgets"
        :key="widget.widgetKey"
        class="min-w-0"
        :class="{ 'lg:col-span-2': widget.widgetKey === 'networth' }"
        :data-widget="widget.widgetKey"
      >
        <NetWorthChart
          v-if="widget.widgetKey === 'networth'"
          v-model:mode="mode"
          v-model:period="netPeriod"
          :data="netWorth ?? null"
        />
        <AllocationCard v-else-if="widget.widgetKey === 'allocation'" v-model:unit="unit" :data="allocation ?? null" />
        <KpiCard v-else-if="widget.widgetKey === 'kpis'" v-model:period="kpiPeriod" :data="kpis ?? null" />
        <HoldingsCard v-else-if="widget.widgetKey === 'holdings'" v-model:range="range" :data="holdings ?? null" />
        <AccountsCard v-else-if="widget.widgetKey === 'accounts'" :data="accountTree ?? null" />
        <ReviewBanner v-else-if="widget.widgetKey === 'review'" :count="review?.count ?? null" />
        <CashflowCard v-else-if="widget.widgetKey === 'cashflow'" />
        <BudgetsCard v-else />
      </section>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import {
  dashboardWidgetKeys,
  type accountsTreeSchema,
  type allocationSchema,
  type dashboardLayoutSchema,
  type kpisSchema,
  type netWorthSchema,
  type periods,
  type topFlopSchema,
} from '@finance/shared';
import AccountsCard from '~/components/dashboard/AccountsCard.vue';
import AllocationCard from '~/components/dashboard/AllocationCard.vue';
import BudgetsCard from '~/components/dashboard/BudgetsCard.vue';
import CashflowCard from '~/components/dashboard/CashflowCard.vue';
import HoldingsCard from '~/components/dashboard/HoldingsCard.vue';
import KpiCard from '~/components/dashboard/KpiCard.vue';
import NetWorthChart from '~/components/dashboard/NetWorthChart.vue';
import ReviewBanner from '~/components/dashboard/ReviewBanner.vue';

type Layout = ReturnType<typeof dashboardLayoutSchema.parse>;
type Period = (typeof periods)[number];
const { get, saveDashboardLayout } = useApi();
const { accounts } = useAccountFilter();
const scope = computed(() => accounts.value.join(',') || undefined);
const netPeriod = ref<Period>('ALL');
const kpiPeriod = ref<Period>('ALL');
const mode = ref<'value' | 'return'>('value');
const unit = ref<'eur' | 'pct'>('eur');
const range = ref<'1D' | '1W' | '1M' | '1Y'>('1D');

const { data: layout, error: layoutError } = useAsyncData('dashboard-layout', () =>
  get<Layout>('/api/dashboard/layout'),
);
const { data: netWorth, error: worthError } = useAsyncData(
  'dashboard-worth',
  () =>
    get<ReturnType<typeof netWorthSchema.parse>>('/api/overview/net-worth', {
      accounts: scope.value,
      period: netPeriod.value,
      mode: mode.value,
    }),
  { watch: [scope, netPeriod, mode] },
);
const { data: allocation, error: allocationError } = useAsyncData(
  'dashboard-allocation',
  () =>
    get<ReturnType<typeof allocationSchema.parse>>('/api/overview/allocation', {
      accounts: scope.value,
      unit: unit.value,
    }),
  { watch: [scope, unit] },
);
const { data: kpis, error: kpiError } = useAsyncData(
  'dashboard-kpis',
  () =>
    get<ReturnType<typeof kpisSchema.parse>>('/api/overview/kpis', { accounts: scope.value, period: kpiPeriod.value }),
  { watch: [scope, kpiPeriod] },
);
const { data: holdings, error: holdingsError } = useAsyncData(
  'dashboard-holdings',
  () =>
    get<ReturnType<typeof topFlopSchema.parse>>('/api/overview/holdings/top-flop', {
      accounts: scope.value,
      range: range.value,
    }),
  { watch: [scope, range] },
);
const { data: accountTree, error: accountsError } = useAsyncData(
  'dashboard-accounts',
  () => get<ReturnType<typeof accountsTreeSchema.parse>>('/api/accounts/tree', { accounts: scope.value }),
  { watch: [scope] },
);
const { data: review, error: reviewError } = useAsyncData(
  'dashboard-review',
  () => get<{ count: number }>('/api/transactions/unreviewed/count', { accounts: scope.value }),
  { watch: [scope] },
);
const dashboardFailed = computed(() =>
  [layoutError, worthError, allocationError, kpiError, holdingsError, accountsError, reviewError].some(
    (error) => !!error.value,
  ),
);
const ordered = computed(
  () => layout.value ?? dashboardWidgetKeys.map((widgetKey, position) => ({ widgetKey, position, visible: true })),
);
const visibleWidgets = computed(() => ordered.value.filter((widget) => widget.visible));
const editing = ref(false);
const saving = ref(false);
const saveFailed = ref(false);
const draft = ref<Layout>([]);

/** Take an editable copy without mutating the persisted layout. */
function startEditing(): void {
  draft.value = ordered.value.map((item) => ({ ...item }));
  saveFailed.value = false;
}

/** Swap adjacent entries with a keyboard-accessible control. */
function move(index: number, step: number): void {
  const origin = draft.value[index];
  const target = draft.value[index + step];
  if (origin && target) [draft.value[index], draft.value[index + step]] = [target, origin];
}

/** Persist the complete layout and preserve the draft if the request fails. */
async function saveLayout(): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  saveFailed.value = false;
  try {
    layout.value = await saveDashboardLayout(draft.value.map((item, position) => ({ ...item, position })));
    editing.value = false;
  } catch {
    saveFailed.value = true;
  } finally {
    saving.value = false;
  }
}
</script>
