<template>
  <div class="flex flex-wrap items-center gap-2">
    <label for="account-filter" class="text-sm">{{ $t('shell.accountFilter') }}</label>
    <USelectMenu
      id="account-filter"
      multiple
      value-key="id"
      label-key="name"
      :model-value="accounts"
      :items="options"
      :placeholder="$t('shell.allAccounts')"
      :aria-label="$t('shell.accountFilter')"
      @update:model-value="setAccounts"
    />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ options?: { id: string; name: string }[] }>(), { options: () => [] });

const { accounts, setAccounts } = useAccountFilter();
</script>
