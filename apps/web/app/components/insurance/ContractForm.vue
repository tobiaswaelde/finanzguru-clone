<template>
  <form class="space-y-4" @submit.prevent="submit">
    <div class="grid gap-3 sm:grid-cols-2">
      <UFormField :label="$t('insurance.kind')"><USelect v-model="kind" :items="kinds" /></UFormField>
      <UFormField :label="$t('insurance.provider')"><UInput v-model="provider" maxlength="120" required /></UFormField>
      <UFormField :label="$t('insurance.number')"><UInput v-model="number" maxlength="120" /></UFormField>
      <UFormField :label="$t('insurance.premium')"
        ><UInput v-model="premium" inputmode="decimal" required
      /></UFormField>
      <UFormField :label="$t('insurance.interval')"><USelect v-model="interval" :items="intervals" /></UFormField>
      <UFormField :label="$t('insurance.start')"><UInput v-model="start" type="date" required /></UFormField>
      <UFormField :label="$t('insurance.end')"><UInput v-model="end" type="date" /></UFormField>
      <UFormField :label="$t('insurance.category')"><USelect v-model="linked" :items="categories" /></UFormField>
    </div>
    <UFormField :label="$t('insurance.notes')"><UTextarea v-model="notes" maxlength="2000" /></UFormField>
    <p v-if="invalid || failed" role="alert" class="text-error">{{ $t('manual.failed') }}</p>
    <div class="flex flex-wrap gap-2">
      <UButton type="submit" :loading="busy">{{ $t('dashboard.save') }}</UButton>
      <UButton type="button" variant="ghost" @click="emit('cancel')">{{ $t('dashboard.cancel') }}</UButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import {
  insuranceInputSchema,
  insuranceIntervals,
  insuranceTypes,
  type insuranceContractSchema,
} from '@finance/shared';
type Contract = ReturnType<typeof insuranceContractSchema.parse>;
type Input = ReturnType<typeof insuranceInputSchema.parse>;
const props = defineProps<{
  initial?: Contract;
  categories: { label: string; value: string }[];
  busy: boolean;
  failed: boolean;
}>();
const emit = defineEmits<{ save: [input: Input]; cancel: [] }>();
const { t } = useI18n();
const kind = ref<Input['type']>(props.initial?.type ?? 'term_life');
const provider = ref(props.initial?.provider ?? '');
const number = ref(props.initial?.contractNumber ?? '');
const premium = ref(props.initial ? (props.initial.premiumCents / 100).toFixed(2).replace('.', ',') : '');
const interval = ref<Input['interval']>(props.initial?.interval ?? 'monthly');
const start = ref(props.initial?.startDate ?? new Date().toISOString().slice(0, 10));
const end = ref(props.initial?.endDate ?? '');
const notes = ref(props.initial?.notes ?? '');
const linked = ref(props.initial?.linkedCategoryId ?? 'none');
const invalid = ref(false);
const kinds = computed(() => insuranceTypes.map((value) => ({ value, label: t(`insurance.types.${value}`) })));
const intervals = computed(() =>
  insuranceIntervals.map((value) => ({ value, label: t(`insurance.intervals.${value}`) })),
);

/** Convert the exact euro input to cents and enforce the shared contract schema. */
function submit(): void {
  const match = /^(\d+)(?:[,.](\d{1,2}))?$/u.exec(premium.value.trim());
  if (!match?.[1]) {
    invalid.value = true;
    return;
  }
  const amount = Number(BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0')));
  const result = insuranceInputSchema.safeParse({
    type: kind.value,
    provider: provider.value,
    contractNumber: number.value.trim() || null,
    premiumCents: amount,
    interval: interval.value,
    startDate: start.value,
    endDate: end.value || null,
    notes: notes.value || null,
    linkedCategoryId: linked.value === 'none' ? null : linked.value,
  });
  invalid.value = !result.success;
  if (result.success) emit('save', result.data);
}
</script>
