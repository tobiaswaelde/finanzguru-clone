/** Read and update the selected account IDs from the shareable query string. */
export function useAccountFilter() {
  const route = useRoute();
  const router = useRouter();
  const accounts = computed(() => {
    const value = route.query.accounts;
    return typeof value === 'string' && value ? [...new Set(value.split(',').filter(Boolean))] : [];
  });

  /** Preserve all unrelated query parameters when replacing the account selection. */
  function setAccounts(ids: string[]) {
    return router.replace({
      query: { ...route.query, accounts: ids.length ? [...new Set(ids)].join(',') : undefined },
    });
  }

  return { accounts, setAccounts };
}
