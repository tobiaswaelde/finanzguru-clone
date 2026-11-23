# Finanzguru Clone

Self-hosted, single-owner wealth tracker with a German interface: Übersicht, Investments, Budget and Versicherung. Money values use integer euro cents. The app does not place orders or initiate payments.

## Local setup

Requires Node.js 26 and pnpm 10. See [API setup](apps/api/README.md) for database and password details.

```bash
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
```

Replace the two secret placeholders in `apps/api/.env` with separate random values. Generate the session secret with `openssl rand -hex 32` and the encryption key with `openssl rand -base64 32`. Use `COOKIE_SECURE=false` only for local HTTP development.

```bash
pnpm --filter api... build
pnpm --filter api db:migrate
pnpm --filter api db:seed
```

Set an [owner password](apps/api/README.md#owner-password), then run `pnpm dev` and open `http://localhost:3000`. To add synthetic sample data, use `pnpm --filter api db:seed --demo` against a disposable database only.

## Architecture and data sources

The [Nuxt web app](apps/web/README.md) serves the UI and proxies same-origin `/api` requests to the [NestJS/Fastify API](apps/api/README.md). The API uses SQLite and Drizzle; `packages/shared` owns the shared Zod schemas and German number formatters.

Import Sparkasse and Scalable CSV files under **Einstellungen → Datenquellen**. Other CSV layouts can use a saved column mapping. Scalable live sync is deferred; CSV remains available. Sparkasse live access is a non-activatable placeholder.

Financial records, imported files, secrets and database backups belong outside Git. Run the app on a trusted host, restrict access to the data directory, and use HTTPS for network access.

## Checks and deployment

- `pnpm format:check`, `pnpm lint` and `pnpm typecheck`: static checks.
- `pnpm test`: Vitest unit, API integration and component tests.
- `pnpm exec playwright install chromium` then `pnpm test:e2e`: browser tests against a disposable database.
- `pnpm docker:local`: build and run both services locally. See the [quickstart](specs/001-wealth-tracker-dashboard/quickstart.md) for validation.
- [Portable deployment](deploy/README.md): image-only Compose, backup and restore.
