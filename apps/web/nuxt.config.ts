export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxtjs/i18n', '@nuxt/eslint'],
  eslint: { config: { autoInit: false } },
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  i18n: {
    defaultLocale: 'de',
    locales: [{ code: 'de', language: 'de-DE', file: 'de.json' }],
    strategy: 'no_prefix',
    detectBrowserLanguage: false,
  },
  runtimeConfig: {
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://127.0.0.1:3001',
  },
});
