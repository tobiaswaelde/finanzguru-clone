export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxtjs/i18n', '@nuxt/eslint'],
  eslint: { config: { autoInit: false } },
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  routeRules:
    process.env.NODE_ENV === 'production'
      ? {
          '/**': {
            headers: {
              // Nuxt color-mode bootstrap and chart/layout styles use inline code.
              'Content-Security-Policy': [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data:",
                "font-src 'self' data:",
                "connect-src 'self'",
                "object-src 'none'",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
              ].join('; '),
              'X-Content-Type-Options': 'nosniff',
              'Referrer-Policy': 'no-referrer',
            },
          },
        }
      : {},
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
