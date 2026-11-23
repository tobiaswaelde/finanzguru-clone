<template>
  <section class="space-y-2" role="status">
    <p class="font-medium">{{ $t(`import.states.${job.status}`) }}</p>
    <p>{{ $t('import.counts', { imported: job.imported, skipped: job.skipped, failed: job.failed }) }}</p>
    <ul v-if="job.errors.length" class="max-h-48 list-inside list-disc overflow-auto text-sm text-muted">
      <li v-for="(entry, index) in job.errors" :key="index">
        {{
          $t('import.rowIssue', { line: entry.line ?? '–', reason: $t(`import.reasons.${entry.reason}`, entry.reason) })
        }}
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { importJobSchema } from '@finance/shared';

defineProps<{ job: ReturnType<typeof importJobSchema.parse> }>();
</script>
