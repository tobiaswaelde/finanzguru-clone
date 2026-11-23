/** Require an owner session before navigating to application pages. */
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login' || to.matched.length === 0) return;
  try {
    await useApi().session();
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 401) {
      return navigateTo('/login');
    }
    return abortNavigation(createError({ statusCode: 503, statusMessage: 'Service Unavailable' }));
  }
});
