<template>
  <div class="space-y-4">
    <UFormField :label="$t('import.account')">
      <select v-model="target" class="w-full rounded border border-default bg-default p-2">
        <option value="">–</option>
        <option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option>
      </select>
    </UFormField>
    <UFileUpload v-model="file" accept=".csv,text/csv" :label="$t('import.chooseFile')" />
    <UButton v-if="!preview" :disabled="!file" :loading="pending" @click="stage">{{
      $t('import.showPreview')
    }}</UButton>
    <template v-if="preview && !result">
      <p class="text-sm">{{ $t('import.format', { format: preview.detectedFormat ?? $t('import.unknownFormat') }) }}</p>
      <ColumnMapper
        v-model:mapping="mapping"
        v-model:save-as="saveAs"
        :headers="preview.headers"
        :preview="preview.preview"
        :needs-mapping="preview.needsMapping"
      />
      <UButton :disabled="!target || (preview.needsMapping && !mapping)" :loading="pending" @click="confirm">
        {{ $t('import.confirm') }}
      </UButton>
    </template>
    <ImportResult v-if="result" :job="result" />
    <p v-if="failed" role="alert" class="text-error">{{ $t('import.error') }}</p>
  </div>
</template>

<script setup lang="ts">
import type { CsvMapping, csvPreviewSchema, importJobSchema } from '@finance/shared';
import ColumnMapper from './ColumnMapper.vue';
import ImportResult from './ImportResult.vue';

defineProps<{ accounts: { id: string; name: string }[] }>();
const emit = defineEmits<{ completed: [] }>();
const { uploadCsv, confirmCsv } = useApi();
const file = ref<File | null>();
const target = ref('');
const preview = ref<ReturnType<typeof csvPreviewSchema.parse>>();
const result = ref<ReturnType<typeof importJobSchema.parse>>();
const mapping = ref<CsvMapping>();
const saveAs = ref('');
const failed = ref(false);
const pending = ref(false);

watch(file, () => {
  preview.value = undefined;
  result.value = undefined;
  mapping.value = undefined;
});

/** Upload one selected file and display its detected format and preview. */
async function stage(): Promise<void> {
  if (!file.value || pending.value) return;
  pending.value = true;
  failed.value = false;
  const selected = file.value;
  try {
    const data = new FormData();
    data.append('file', selected);
    if (target.value) data.append('accountId', target.value);
    const staged = await uploadCsv(data);
    if (selected !== file.value) return;
    preview.value = staged;
    if (staged.accountId) target.value = staged.accountId;
  } catch {
    failed.value = true;
  } finally {
    pending.value = false;
  }
}

/** Confirm the mapping and account, then refresh dependent dashboard data. */
async function confirm(): Promise<void> {
  if (!preview.value || !target.value || pending.value) return;
  pending.value = true;
  failed.value = false;
  try {
    const custom = preview.value.needsMapping;
    result.value = await confirmCsv(preview.value.jobId, {
      accountId: target.value,
      mapping: custom ? mapping.value : undefined,
      saveMappingAs: custom && saveAs.value.trim() ? saveAs.value.trim() : undefined,
    });
    emit('completed');
  } catch {
    failed.value = true;
  } finally {
    pending.value = false;
  }
}
</script>
