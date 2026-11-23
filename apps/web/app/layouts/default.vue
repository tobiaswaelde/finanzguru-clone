<template>
  <header class="border-b border-default">
    <UContainer class="space-y-3 py-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <NuxtLink to="/">
          <BrandLogo />
        </NuxtLink>
        <div class="flex flex-wrap gap-2">
          <UButton disabled color="neutral" variant="ghost">
            {{ $t('shell.search') }}
          </UButton>
          <UButton disabled color="neutral" variant="ghost">
            {{ $t('shell.add') }}
          </UButton>
          <slot name="profile">
            <UButton disabled color="neutral" variant="ghost">
              {{ $t('shell.profile') }}
            </UButton>
          </slot>
          <UColorModeButton />
        </div>
      </div>
      <nav class="flex flex-wrap gap-x-4 gap-y-2" :aria-label="$t('shell.navigation')">
        <NuxtLink
          v-for="item in links"
          :key="item.to"
          class="rounded py-2 text-sm font-medium hover:text-primary"
          exact-active-class="text-primary"
          :to="{ path: item.to, query: accountQuery }"
        >
          {{ $t(item.label) }}
        </NuxtLink>
      </nav>
    </UContainer>
  </header>
  <UContainer class="py-4">
    <AccountFilter />
  </UContainer>
  <slot />
</template>

<script setup lang="ts">
import AccountFilter from '~/components/common/AccountFilter.vue';

const links = [
  { to: '/', label: 'overview.title' },
  { to: '/investments', label: 'shell.investments' },
  { to: '/budget', label: 'shell.budget' },
  { to: '/insurance', label: 'shell.insurance' },
] as const;
const { accounts } = useAccountFilter();
const accountQuery = computed(() => (accounts.value.length ? { accounts: accounts.value.join(',') } : {}));
</script>
