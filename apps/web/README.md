# Web

Nuxt renders the German owner interface. Nuxt UI supplies forms and navigation; Unovis supplies charts. Labels live in `i18n/locales/de.json`.

Run `pnpm dev` from the root to start both services. For web-only development with an existing API, run `NUXT_API_BASE_URL=http://127.0.0.1:3001 pnpm --filter web dev`. This URL is server-side; the browser calls same-origin `/api`.

Use `pnpm --filter web build` for the Nitro production build and `pnpm --filter web test` for component tests. Browser journeys and responsive checks run from the repository root with `pnpm test:e2e`.
