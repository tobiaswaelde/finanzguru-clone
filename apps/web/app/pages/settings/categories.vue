<template>
  <UContainer as="main" class="space-y-4 pb-8">
    <NuxtLink class="text-primary" to="/budget">{{ $t('shell.budget') }}</NuxtLink>
    <h1 class="text-2xl font-semibold">{{ $t('budget.categories') }}</h1>
    <form class="flex flex-wrap items-end gap-3" @submit.prevent="saveCategory">
      <UFormField :label="$t('budget.categoryName')"><UInput v-model="name" required /></UFormField>
      <UFormField :label="$t('import.fields.type')"><USelect v-model="kind" :items="kinds" /></UFormField>
      <UFormField :label="$t('budget.parent')"><USelect v-model="parent" :items="parents" /></UFormField>
      <UButton type="submit">{{ $t('dashboard.save') }}</UButton>
      <UButton v-if="editing" variant="ghost" @click="reset">{{ $t('dashboard.cancel') }}</UButton>
    </form>
    <p v-if="failed" role="alert" class="text-error">{{ $t('manual.failed') }}</p>
    <ul class="divide-y divide-default">
      <li v-for="item in flat" :key="item.id" class="flex flex-wrap items-center gap-2 py-2">
        <span class="mr-auto" :class="{ 'pl-4': item.parentId }">{{ item.name }}</span>
        <UButton variant="outline" size="xs" @click="edit(item)">{{ $t('budget.edit') }}</UButton>
        <UButton v-if="!item.isDefault" variant="outline" color="error" size="xs" @click="removeCategory(item.id)">{{
          $t('budget.delete')
        }}</UButton>
      </li>
    </ul>
    <h2 class="font-semibold">{{ $t('budget.rules') }}</h2>
    <UButton variant="outline" @click="applyRules">{{ $t('budget.applyRules') }}</UButton>
    <p v-if="updated !== null" role="status">{{ $t('budget.ruleResult', { count: updated }) }}</p>
    <ul class="divide-y divide-default">
      <li v-for="rule in rules" :key="rule.id" class="flex flex-wrap items-center gap-2 py-2">
        <span class="mr-auto">{{ rule.priority }} · {{ rule.pattern }}</span>
        <UCheckbox
          :model-value="rule.enabled"
          :label="$t('budget.enabled')"
          @update:model-value="toggleRule(rule.id, $event === true)"
        />
        <UButton variant="outline" size="xs" color="error" @click="removeRule(rule.id)">{{
          $t('budget.delete')
        }}</UButton>
      </li>
    </ul>
  </UContainer>
</template>

<script setup lang="ts">
import { categoryKinds, type categorySchema, type categoryTreeSchema, type ruleSchema } from '@finance/shared';

type Category = ReturnType<typeof categorySchema.parse>;
const { get, mutate } = useApi();
const { t } = useI18n();
const { data: tree, refresh: reloadCategories } = useAsyncData('settings-categories', () =>
  get<ReturnType<typeof categoryTreeSchema.parse>>('/api/categories'),
);
const { data: rules, refresh: reloadRules } = useAsyncData('settings-rules', () =>
  get<ReturnType<typeof ruleSchema.parse>[]>('/api/rules'),
);
const flat = computed(() => (tree.value ?? []).flatMap((row) => [row, ...row.children]));
const editing = ref('');
const name = ref('');
const kind = ref<(typeof categoryKinds)[number]>('expense');
const parent = ref('root');
const failed = ref(false);
const updated = ref<number | null>(null);
const kinds = computed(() => categoryKinds.map((value) => ({ value, label: t(`budget.kinds.${value}`) })));
const parents = computed(() => [
  { value: 'root', label: t('budget.noParent') },
  ...(tree.value ?? [])
    .filter((item) => item.kind === kind.value && item.id !== editing.value)
    .map((item) => ({ value: item.id, label: item.name })),
]);

/** Reset the category editor. */
function reset(): void {
  editing.value = '';
  name.value = '';
  parent.value = 'root';
}
/** Load the chosen category into the editor. */
function edit(item: Category): void {
  editing.value = item.id;
  name.value = item.name;
  kind.value = item.kind;
  parent.value = item.parentId ?? 'root';
}
/** Persist the edited category or create a new one. */
async function saveCategory(): Promise<void> {
  failed.value = false;
  try {
    const current = flat.value.find((item) => item.id === editing.value);
    const input = {
      name: name.value.trim(),
      kind: kind.value,
      parentId: parent.value === 'root' ? null : parent.value,
      color: current?.color ?? 'neutral',
    };
    if (editing.value) await mutate(`/api/categories/${editing.value}`, 'PATCH', input);
    else await mutate('/api/categories', 'POST', input);
    reset();
    await reloadCategories();
  } catch {
    failed.value = true;
  }
}
/** Remove a non-default category if allowed by the API. */
async function removeCategory(id: string): Promise<void> {
  try {
    await mutate(`/api/categories/${id}`, 'DELETE');
    await reloadCategories();
  } catch {
    failed.value = true;
  }
}
/** Toggle rule participation. */
async function toggleRule(id: string, enabled: boolean): Promise<void> {
  try {
    await mutate(`/api/rules/${id}`, 'PATCH', { enabled });
    await reloadRules();
  } catch {
    failed.value = true;
  }
}
/** Delete one reusable rule. */
async function removeRule(id: string): Promise<void> {
  try {
    await mutate(`/api/rules/${id}`, 'DELETE');
    await reloadRules();
  } catch {
    failed.value = true;
  }
}
/** Reapply configured rules and display the count changed. */
async function applyRules(): Promise<void> {
  try {
    const result = await mutate<{ updated: number }>('/api/rules/apply', 'POST');
    updated.value = result.updated;
    clearNuxtData((key) => key.startsWith('dashboard-'));
  } catch {
    failed.value = true;
  }
}
</script>
