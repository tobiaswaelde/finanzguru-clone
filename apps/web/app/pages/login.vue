<template>
  <main class="mx-auto w-full max-w-sm px-4 py-20">
    <BrandLogo />
    <h1 class="my-4 text-xl font-semibold">{{ $t('auth.signIn') }}</h1>
    <form class="space-y-4" @submit.prevent="submit">
      <UFormField name="password" :label="$t('auth.password')">
        <UInput
          v-model="password"
          type="password"
          autocomplete="current-password"
          maxlength="1024"
          required
          :disabled="!ready"
        />
      </UFormField>
      <p v-if="failure" role="alert" class="text-sm text-error">{{ $t(failure) }}</p>
      <UButton type="submit" :disabled="!ready" :loading="pending">{{ $t('auth.signIn') }}</UButton>
    </form>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: false });

const { login } = useApi();
const password = ref('');
const pending = ref(false);
const ready = ref(false);
onMounted(() => {
  ready.value = true;
});
const failure = ref<'auth.invalid' | 'auth.rateLimited' | 'auth.unavailable'>();

/** Submit the password without storing it in application state beyond the form. */
async function submit(): Promise<void> {
  if (pending.value) return;
  pending.value = true;
  failure.value = undefined;
  try {
    await login({ password: password.value });
    password.value = '';
    await navigateTo('/');
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'statusCode' in error ? error.statusCode : undefined;
    failure.value = status === 401 ? 'auth.invalid' : status === 429 ? 'auth.rateLimited' : 'auth.unavailable';
  } finally {
    pending.value = false;
  }
}
</script>
