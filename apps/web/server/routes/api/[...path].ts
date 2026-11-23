export default defineEventHandler((event) => {
  const { apiBaseUrl } = useRuntimeConfig(event);
  const target = new URL(process.env.API_BASE_URL ?? apiBaseUrl);
  const request = getRequestURL(event);
  target.pathname = request.pathname;
  target.search = request.search;
  return proxyRequest(event, target.href);
});
