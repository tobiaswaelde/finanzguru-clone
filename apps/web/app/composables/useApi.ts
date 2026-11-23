import type { accountsListSchema, dashboardLayoutSchema, loginSchema, sessionSchema } from '@finance/shared';

/** Same-origin API access, forwarding the request cookie during server rendering. */
export function useApi() {
  const request = useRequestFetch();
  return {
    /** Read a typed owner-scoped resource via the same-origin proxy. */
    get: <T>(path: `/api/${string}`, query?: Record<string, string | undefined>) => request<T>(path, { query }),
    /** Replace the complete owner dashboard layout. */
    saveDashboardLayout: (body: ReturnType<typeof dashboardLayoutSchema.parse>) =>
      request<ReturnType<typeof dashboardLayoutSchema.parse>>('/api/dashboard/layout', { method: 'PUT', body }),
    /** Read visible accounts for the global selection. */
    accounts: () => request<ReturnType<typeof accountsListSchema.parse>>('/api/accounts'),
    /** Look up the current session without exposing its sealed contents. */
    session: () => request<ReturnType<typeof sessionSchema.parse>>('/api/auth/session'),
    /** Authenticate and let the browser store the sealed cookie. */
    login: (body: ReturnType<typeof loginSchema.parse>) =>
      request<undefined>('/api/auth/login', { method: 'POST', body }),
    /** Clear the current session cookie. */
    logout: () => request<undefined>('/api/auth/logout', { method: 'POST' }),
  };
}
