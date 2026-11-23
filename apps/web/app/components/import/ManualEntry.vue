<template>
  <form class="space-y-4" @submit.prevent="save">
    <template v-if="kind === 'account'">
      <UFormField :label="$t('manual.name')" required>
        <UInput v-model="name" maxlength="80" required />
      </UFormField>
      <UFormField :label="$t('manual.accountType')">
        <USelect v-model="accountType" :items="accountItems" />
      </UFormField>
    </template>
    <template v-else>
      <UFormField :label="$t('import.account')" required>
        <USelect v-model="accountId" value-key="id" label-key="name" :items="cashAccounts" />
      </UFormField>
      <UFormField :label="$t('import.fields.date')" required>
        <UInput v-model="date" type="date" required />
      </UFormField>
      <UFormField :label="$t('import.fields.purpose')">
        <UInput v-model="purpose" maxlength="300" />
      </UFormField>
    </template>
    <UFormField :label="$t(kind === 'account' ? 'manual.balance' : 'import.fields.amount')" required>
      <UInput v-model="amount" inputmode="decimal" required />
    </UFormField>
    <p v-if="failed" role="alert" class="text-error">{{ $t('manual.failed') }}</p>
    <UButton type="submit" :loading="pending">{{ $t('dashboard.save') }}</UButton>
  </form>
</template>

<script setup lang="ts">
import { accountTypes, manualAccountSchema, manualTransactionSchema } from '@finance/shared';

const props = defineProps<{
  kind: 'account' | 'transaction';
  accounts: { id: string; name: string; type: string }[];
}>();
const emit = defineEmits<{ completed: [] }>();
const { t } = useI18n();
const { createAccount, createTransaction } = useApi();
const accountType = ref<(typeof accountTypes)[number]>('checking');
const accountItems = computed(() =>
  accountTypes.map((type) => ({ label: t(`manual.accountTypes.${type}`), value: type })),
);
const cashAccounts = computed(() =>
  props.accounts.filter((item) => item.type !== 'depot').map(({ id, name }) => ({ id, name })),
);
const name = ref('');
const accountId = ref('');
const amount = ref('0');
const date = ref(new Date().toISOString().slice(0, 10));
const purpose = ref('');
const pending = ref(false);
const failed = ref(false);

/** Parse a signed euro number with at most two decimals into integer cents. */
function cents(input: string): number | undefined {
  const match = /^([+-]?)(\d+)(?:[,.](\d{1,2}))?$/u.exec(input.trim());
  if (!match) return undefined;
  const [, sign, whole, fraction = ''] = match;
  const result = Number(BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0')));
  return Number.isSafeInteger(result) ? (sign === '-' ? -result : result) : undefined;
}

/** Submit one manually entered account or cash booking. */
async function save(): Promise<void> {
  failed.value = false;
  pending.value = true;
  try {
    const value = cents(amount.value);
    if (value === undefined) throw new Error('Invalid amount');
    if (props.kind === 'account') {
      await createAccount(
        manualAccountSchema.parse({ name: name.value, type: accountType.value, balanceCents: value }),
      );
    } else {
      await createTransaction(
        manualTransactionSchema.parse({
          accountId: accountId.value,
          bookingDate: date.value,
          amountCents: value,
          type: value < 0 ? 'expense' : 'income',
          purpose: purpose.value.trim() || null,
        }),
      );
    }
    emit('completed');
  } catch {
    failed.value = true;
  } finally {
    pending.value = false;
  }
}
</script>
