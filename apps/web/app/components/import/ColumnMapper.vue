<template>
  <div class="space-y-3">
    <div class="overflow-x-auto" tabindex="0" :aria-label="$t('import.preview')">
      <table class="w-full text-left text-sm">
        <thead>
          <tr>
            <th v-for="(header, index) in headers" :key="index" class="p-2">{{ header }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in preview" :key="index">
            <td v-for="(cell, column) in row" :key="column" class="max-w-64 truncate p-2">{{ cell }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="needsMapping" class="grid gap-2 sm:grid-cols-2">
      <label v-for="field in fields" :key="field" class="grid gap-1 text-sm">
        {{ $t(`import.fields.${field}`) }}
        <select
          class="rounded border border-default bg-default p-2"
          :value="columns[field] ?? ''"
          :aria-label="$t(`import.fields.${field}`)"
          @change="setColumn(field, $event)"
        >
          <option value="">–</option>
          <option v-for="(header, index) in headers" :key="index" :value="index">{{ header }}</option>
        </select>
      </label>
      <label class="grid gap-1 text-sm">
        {{ $t('import.dateFormat') }}
        <select v-model="dateFormat" class="rounded border border-default bg-default p-2">
          <option>YYYY-MM-DD</option>
          <option>DD.MM.YY</option>
          <option>DD.MM.YYYY</option>
        </select>
      </label>
      <label class="grid gap-1 text-sm">
        {{ $t('import.decimalSeparator') }}
        <select v-model="decimal" class="rounded border border-default bg-default p-2">
          <option>.</option>
          <option>,</option>
        </select>
      </label>
      <UFormField :label="$t('import.skipRows')">
        <UInput v-model.number="skipRows" type="number" min="0" max="1000" />
      </UFormField>
      <UFormField :label="$t('import.saveMapping')">
        <UInput v-model="saveAs" maxlength="80" />
      </UFormField>
    </div>
  </div>
</template>

<script setup lang="ts">
import { csvMappingInputSchema, type CsvMapping } from '@finance/shared';

defineProps<{ headers: string[]; preview: string[][]; needsMapping: boolean }>();
const mapping = defineModel<CsvMapping | undefined>('mapping');
const saveAs = defineModel<string>('saveAs', { default: '' });
const fields = [
  'date',
  'amount',
  'valueDate',
  'counterparty',
  'iban',
  'purpose',
  'isin',
  'quantity',
  'price',
  'fee',
  'tax',
  'type',
] as const;
const columns = reactive<Partial<CsvMapping['columns']>>({});
const dateFormat = ref<CsvMapping['dateFormat']>('YYYY-MM-DD');
const decimal = ref<CsvMapping['decimalSeparator']>('.');
const skipRows = ref<number>(0);

/** Update the selected column and omit unassigned optional fields. */
function setColumn(field: (typeof fields)[number], event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  columns[field] = value === '' ? undefined : Number(value);
}

watchEffect(() => {
  const result = csvMappingInputSchema.safeParse({
    columns,
    dateFormat: dateFormat.value,
    decimalSeparator: decimal.value,
    skipRows: skipRows.value,
  });
  mapping.value = result.success ? result.data : undefined;
});
</script>
