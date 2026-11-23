<template>
  <UContainer as="main" class="space-y-4 pb-8">
    <NuxtLink class="text-primary" to="/budget">{{ $t('shell.budget') }}</NuxtLink>
    <h1 class="text-2xl font-semibold">{{ $t('dashboard.budgets') }}</h1>
    <form class="flex flex-wrap items-end gap-3" @submit.prevent="save">
      <UFormField :label="$t('budget.chooseCategory')">
        <USelect v-model="selected" :items="options" :disabled="!ready" />
      </UFormField>
      <UFormField :label="$t('budget.limit')">
        <UInput v-model="amount" inputmode="decimal" required />
      </UFormField>
      <UButton type="submit" :disabled="!selected" :loading="busy">{{ $t('dashboard.save') }}</UButton>
    </form>
    <p v-if="failed || error" role="alert" class="text-error">{{ $t('manual.failed') }}</p>
    <BudgetsCard :data="rows ?? []" :names="names" />
    <ul class="space-y-1">
      <li v-for="row in rows" :key="row.id" class="flex flex-wrap items-center gap-2">
        <span>{{ names[row.categoryId] }}</span>
        <UButton size="xs" variant="outline" @click="edit(row)">{{ $t('budget.edit') }}</UButton>
        <UButton size="xs" variant="outline" color="error" @click="remove(row.id)">{{ $t('budget.delete') }}</UButton>
      </li>
    </ul>
  </UContainer>
</template>

<script setup lang="ts">
import { budgetInputSchema, type budgetSchema, type budgetsSchema, type categoryTreeSchema } from '@finance/shared';
import BudgetsCard from '~/components/dashboard/BudgetsCard.vue';

type Budget = ReturnType<typeof budgetSchema.parse>;
const { get, mutate } = useApi();
const { accounts } = useAccountFilter();
const scope = computed(() => accounts.value.join(',') || undefined);
const {
  data: rows,
  error,
  refresh,
} = useAsyncData(
  'budget-limits',
  () => get<ReturnType<typeof budgetsSchema.parse>>('/api/budgets', { accounts: scope.value }),
  { watch: [scope] },
);
const { data: tree } = useAsyncData('budget-limit-categories', () =>
  get<ReturnType<typeof categoryTreeSchema.parse>>('/api/categories'),
);
const options = computed(() =>
  (tree.value ?? [])
    .flatMap((row) => [row, ...row.children])
    .filter((row) => row.kind === 'expense')
    .map((row) => ({ value: row.id, label: row.name })),
);
const names = computed(() => Object.fromEntries(options.value.map((item) => [item.value, item.label])));
const selected = ref('');
const amount = ref('');
const editing = ref('');
const failed = ref(false);
const busy = ref(false);
const ready = ref(false);
onMounted(() => {
  ready.value = true;
});

/** Populate the form from one existing budget limit. */
function edit(row: Budget): void {
  editing.value = row.id;
  selected.value = row.categoryId;
  amount.value = (row.monthlyLimitCents / 100).toFixed(2).replace('.', ',');
}

/** Save a positive euro limit through the shared cents schema. */
async function save(): Promise<void> {
  if (busy.value) return;
  failed.value = false;
  busy.value = true;
  try {
    const raw = amount.value.trim();
    if (!/^\d+(?:[.,]\d{1,2})?$/u.test(raw)) throw new Error('Invalid amount');
    const [whole, fraction = ''] = raw.split(/[.,]/u);
    const input = budgetInputSchema.parse({
      categoryId: selected.value,
      monthlyLimitCents: Number(BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'))),
    });
    if (editing.value) await mutate(`/api/budgets/${editing.value}`, 'PATCH', input);
    else await mutate('/api/budgets', 'POST', input);
    editing.value = '';
    selected.value = '';
    amount.value = '';
    clearNuxtData('dashboard-budgets');
    await refresh();
  } catch {
    failed.value = true;
  } finally {
    busy.value = false;
  }
}

/** Remove a selected limit and refresh the overview widget. */
async function remove(id: string): Promise<void> {
  try {
    await mutate(`/api/budgets/${id}`, 'DELETE');
    clearNuxtData('dashboard-budgets');
    await refresh();
  } catch {
    failed.value = true;
  }
}
</script>
