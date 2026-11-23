---
description: "Task list for Personal Wealth Tracker Dashboard"
---

# Tasks: Personal Wealth Tracker Dashboard

**Input**: Design documents from `/specs/001-wealth-tracker-dashboard/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Requested. plan.md (Technical Context › Testing) requires Vitest unit tests for domain math and parsers, Nest e2e tests per controller, component tests, and a Playwright journey per user story. Each implementation task includes its own tests. The quickstart gates (`pnpm lint`, `pnpm typecheck`, `pnpm test`, plus `pnpm test:e2e` once E2E exists) must pass before each task's commit.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on its own. One task = one commit.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: User story from spec.md (US1–US7)

## Path Conventions

- Frontend: `apps/web/app/…`; component tests in `apps/web/tests/`
- Backend: `apps/api/src/…`; tests in `apps/api/test/{unit,e2e,fixtures}/`
- Shared contracts: `packages/shared/src/…`
- Browser E2E: `e2e/`
- Container and deployment: `apps/*/Dockerfile`, `compose.local.yaml`, `deploy/`, `.github/workflows/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo, toolchain, runnable empty apps, container builds

- [x] T001 Create the pnpm workspace root in `package.json` (private, `engines.node: ">=26 <27"`, `packageManager: pnpm@10`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `.nvmrc` (`26`), `.editorconfig`, `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), and extend `.gitignore` with `.nuxt`, `.output`, `dist`, `apps/api/data/`, `data-local/`
- [x] T002 [P] Scaffold `packages/shared` as a TS library (`packages/shared/package.json` with `exports`, `src/index.ts`, `tsconfig.json`, build via `tsc -b`) with `zod` and `decimal.js`
- [x] T003 [P] Scaffold the NestJS 11 app on the Fastify adapter in `apps/api` (`src/main.ts` with global prefix `api` and `PORT` default 3001, `src/app.module.ts`, `nest-cli.json`, `tsconfig.json`), env validation with zod in `apps/api/src/config/env.schema.ts` (`PORT`, `API_SESSION_SECRET` ≥ 32 bytes, `API_ENCRYPTION_KEY` 32-byte base64, `DATABASE_PATH`, `COOKIE_SECURE` boolean default `true`), and `apps/api/.env.example`
- [ ] T004 [P] Scaffold the Nuxt 4 app in `apps/web` with `@nuxt/ui` v4 and `@nuxtjs/i18n` (default `de`): `apps/web/nuxt.config.ts` with `routeRules: { '/api/**': { proxy: '${API_BASE_URL}/api/**' } }` from `runtimeConfig.apiBaseUrl`, `apps/web/app/assets/css/main.css`, `apps/web/.env.example` (`API_BASE_URL=http://localhost:3001`)
- [ ] T005 Configure root tooling in `eslint.config.mjs` (`@nuxt/eslint` for web, `typescript-eslint` for api/shared), `.prettierrc`, and root `package.json` scripts `dev` (api + web in parallel), `build`, `lint`, `typecheck` (`vue-tsc --noEmit` web, `tsc --noEmit` api/shared), `test`, `test:e2e`, `docker:local`
- [ ] T006 [P] Configure Vitest in `apps/api/vitest.config.ts` (`unplugin-swc` for decorator metadata; projects `unit` and `e2e`), `apps/web/vitest.config.ts` (`@nuxt/test-utils`), and `packages/shared/vitest.config.ts`, each with one passing smoke test
- [ ] T007 [P] Configure Playwright in `e2e/playwright.config.ts` with projects `desktop` (1280×800) and `mobile` (360×780); `webServer` starts api + web against a temp SQLite file; smoke test `e2e/smoke.spec.ts` opens `/login`
- [ ] T008 [P] Add CI in `.github/workflows/ci.yml`: Node 26, pnpm cache, `pnpm install --frozen-lockfile`, lint, typecheck, test, Playwright (desktop + mobile)
- [ ] T009 [P] Add `apps/api/Dockerfile` (multi-stage on `node:26-bookworm-slim`: builder with build tools for `better-sqlite3`, `pnpm deploy --filter api --prod`, runtime as non-root `node`, `EXPOSE 3001`, no `VOLUME`, `DATABASE_PATH=/data/app.db`) and `apps/web/Dockerfile` (multi-stage, `nuxt build`, runs `.output/server/index.mjs` as non-root, `EXPOSE 3000`), plus `.dockerignore`
- [ ] T010 Add `compose.local.yaml` for the local container test: top-level order `name: finance-clone`, `networks`, `services`; services `finance-api` and `finance-web` built from the two Dockerfiles, own bridge `finance-internal`, web published on `localhost:3000`, bind mount `./data-local/api:/data` (no named or anonymous volumes), `env_file: apps/api/.env`, `COOKIE_SECURE=false`, healthchecks on `/api/health`; verify `pnpm docker:local` starts both containers
- [ ] T011 Add the release workflow `.github/workflows/release.yml`: on push to `main` and tags `v*`, build both images with `docker/build-push-action` and publish to the lowercase GHCR namespace derived from the current repository; use `latest`, `sha-<short>`, and the semver tag when applicable (`permissions: packages: write`). Validate workflow and tag rules without triggering a release.

**Checkpoint**: `pnpm dev` serves web on :3000 proxying to api on :3001; `pnpm docker:local` runs the same in containers; all gates green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB, shared entities, auth, shared contracts, domain primitives, app shell, demo seed. No user story starts before this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T012 Add Drizzle ORM, `better-sqlite3` and `drizzle-kit` in `apps/api`; create `apps/api/src/database/drizzle.module.ts` (global provider `DB`, WAL mode, foreign keys on, path from `DATABASE_PATH`) and `apps/api/drizzle.config.ts`; verify that `better-sqlite3` installs on Node 26 locally and in the Docker build (research R2) and record the outcome in `apps/api/README.md`
- [ ] T013 Define the shared entities in `apps/api/src/database/schema.ts` and generate the first migration in `apps/api/src/database/migrations/` (`db:migrate` script). Conventions: "`id` = `TEXT` UUIDv7", "Money = `INTEGER` cents (EUR)", "Decimals (quantity, price, rate) = `TEXT`". Constraints: `owner` ("single row"; `display_name` "1–60 chars"; `password_hash` "scrypt"; `inflation_rate` "default `0.0253`, 0–0.5"); `institution` (`name` "unique"; `bic` "8/11 chars"); `account` (`name` "1–80"; `type` "`depot`, `checking`, `savings`, `reference`, `credit_card`, `cash`"; `iban` "validated IBAN checksum; unique when set"; `is_hidden` "default false"); `instrument` (`isin` "unique, ISIN checksum"; `wkn` "6 chars"; `asset_class` "`stock`, `etf`, `fund`, `bond`, `crypto`, `commodity`, `other`"; `currency` "ISO 4217"); `price` ("PK (instrument_id, date)"; `close` "> 0, EUR"; `source` "`scalable`, `csv`, `manual`"); `transaction` (index `(account_id, booking_date)`; `type` "`income`, `expense`, `transfer`, `buy`, `sell`, `dividend`, `interest`, `tax`, `fee`, `split`, `deposit`, `withdrawal`"; `instrument_id` "required for buy/sell/dividend/split"; `quantity` "required for buy/sell; split = ratio"; `fee_cents`/`tax_cents` "default 0"; `category_source` "`manual`, `rule`, `import`"; `review_status` "`unreviewed`, `reviewed` (default `unreviewed`)"; `source` "`csv`, `scalable_mcp`, `manual`"; `source_ref` "unique with `source`"; `fingerprint` "unique"); `category` (`parent_id` "max depth 2"; `name` "unique within parent"; `kind` "`income`, `expense`, `savings`, `transfer`"); `data_source` (`kind` "`csv`, `scalable_mcp`, `sparkasse_fints`"; `status` "`active`, `needs_reauth`, `error`, `planned`, `disabled`"; `encrypted_credentials` "AES-256-GCM (iv + tag + ciphertext); never returned by API"); derived `net_worth_snapshot` ("PK (account_id, date)") and `position_lot` (`quantity_open` "≥ 0")
- [ ] T014 [P] Create shared enums and zod schemas in `packages/shared/src/schemas/` (`common.ts` with `period`, `accounts`, date and cents primitives; `account.ts`, `instrument.ts`, `transaction.ts`, `category.ts`, `source.ts`) matching contracts/http-api.md
- [ ] T015 [P] Implement de-DE formatting helpers in `packages/shared/src/format.ts` (`formatEur(cents)` → `1.856,45 €`, signed variants, `formatPct`, `formatDate`) and IBAN/ISIN checksum validators in `packages/shared/src/validators.ts`, with unit tests in `packages/shared/test/`
- [ ] T016 Wire validation, docs, errors and health in `apps/api/src/main.ts`: global `ZodValidationPipe` (`nestjs-zod`), Swagger at `/api/docs` (dev only), exception filter `apps/api/src/common/filters/http-exception.filter.ts` producing `{ statusCode, statusMessage, data?: { issues } }`, `nestjs-pino` with cookie/authorization redaction, and `GET /api/health` (`@Public()`, `{ status: 'ok', db: 'ok' }` or 503) in `apps/api/src/modules/health/`; e2e test in `apps/api/test/e2e/health.e2e-spec.ts`
- [ ] T017 [P] Implement `CryptoService` (AES-256-GCM, `iv|tag|ciphertext`, key from `API_ENCRYPTION_KEY`) in `apps/api/src/common/crypto.service.ts` with round-trip and tamper tests in `apps/api/test/unit/crypto.service.spec.ts`
- [ ] T018 Implement `AuthModule` in `apps/api/src/modules/auth/`: `@fastify/secure-session` (httpOnly, `sameSite=lax`, `secure` from `COOKIE_SECURE`), scrypt hashing, `POST /api/auth/login` (`@Public()`, `@nestjs/throttler` 5/min), `POST /api/auth/logout`, `GET /api/auth/session`, global `SessionGuard`; CLI `owner:set-password` in `apps/api/src/scripts/set-password.ts`; e2e tests in `apps/api/test/e2e/auth.e2e-spec.ts` (401 without cookie, 204 on login, throttling)
- [ ] T019 [P] Implement `apps/api/src/domain/money.ts` (cents arithmetic, `decimal.js` helpers, half-even rounding) and `apps/api/src/domain/period.ts` (`1W|1M|YTD|1Y|3Y|5Y|ALL` and `from/to` to date ranges; month/quarter/year anchors) with unit tests in `apps/api/test/unit/`
- [ ] T020 [P] Define the `DataSource` interface and normalized types in `packages/shared/src/sources.ts` and `apps/api/src/modules/sources/data-source.interface.ts` exactly as in contracts/data-source.md, plus `ForbiddenToolError`, `AuthExpiredError`, `UpstreamError`, `NotImplementedError` in `apps/api/src/modules/sources/errors.ts`, and `SourcesRegistry` in `apps/api/src/modules/sources/sources.registry.ts`
- [ ] T021 Implement `apps/api/src/domain/positions.ts` (FIFO lots, average entry price of open lots, realized gain on sell, split ratio on open lots — research R9) and `apps/api/src/domain/snapshots.ts` (daily `value_cents`, `invested_cents`, `external_flow_cents` per account; last known price carried forward and flagged stale) with unit tests incl. split and partial sell in `apps/api/test/unit/positions.spec.ts` and `snapshots.spec.ts`
- [ ] T022 Implement `RecomputeService` in `apps/api/src/modules/import/recompute.service.ts`: rebuild `position_lot` and `net_worth_snapshot` for given accounts from a start date inside the caller's DB transaction; unit tests
- [ ] T023 Seed defaults in `apps/api/src/database/seed.ts` (`db:seed`): German category tree per FR-031 (Wohnen › Miete / Wohngeld, Strom, Wohnnebenkosten; Lebenshaltung › Lebensmittel und Getränke, Handy, Festnetz und Internet, Sonstige; Shopping und Unterhaltung; Sparen und Anlegen › Wertpapieranlage; Versicherung › Risiko-Lebensversicherung; Bank und Kredit; Gesundheit und Wellness › Arznei- und Heilmittel; Freizeit, Hobbies und Soziales; Einnahmen › Gehalt, Sonstige Einnahmen; Umbuchung) with `is_default = true`; institution `Manuell`; data sources `csv` (`active`) and `sparkasse_fints` (`planned`)
- [ ] T024 Build the deterministic demo dataset in `apps/api/src/database/demo.ts` (`db:seed --demo`): 1 depot with 3 ETFs + 2 stocks incl. one fully sold position, 1 reference account, 1 checking account, 3 years of daily prices, monthly salary/rent/groceries; run `RecomputeService` at the end; expected totals documented in `apps/api/test/fixtures/demo-expected.json`
- [ ] T025 Build the app shell in `apps/web/app/layouts/default.vue`: header with own logo/name (research R15), search/menu/profile slots, nav for Übersicht / Investments / Budget / Versicherung, floating account filter `apps/web/app/components/common/AccountFilter.vue` with state in `apps/web/app/composables/useAccountFilter.ts` synced to `?accounts=`, color-mode toggle; brand theme in `apps/web/app/app.config.ts`
- [ ] T026 [P] Add `apps/web/app/pages/login.vue`, route middleware `apps/web/app/middleware/auth.global.ts` (redirect to `/login` on 401), and typed `apps/web/app/composables/useApi.ts` (`useRequestFetch` on SSR to forward cookies; types from `packages/shared`)
- [ ] T027 [P] Add shared UI atoms in `apps/web/app/components/common/` (`Money.vue` green/red by sign per FR-004, `Percent.vue`, `PeriodTabs.vue`, `EmptyState.vue`, `InfoTooltip.vue`) and placeholder pages for all four tabs; component tests in `apps/web/tests/common.spec.ts`

**Checkpoint**: Log in, see the shell with four tabs and the account filter; demo data is in the DB.

---

## Phase 3: User Story 1 - See total net worth at a glance (Priority: P1) 🎯 MVP

**Goal**: The Übersicht tab with all eight widgets on real or demo data.

**Independent Test**: `pnpm --filter api db:seed --demo`, open `/`; every widget is filled and Gesamtvermögen = Σ depot values + Σ cash to the cent (quickstart V5–V7).

- [ ] T028 [P] [US1] Implement `apps/api/src/domain/returns.ts` (TWROR chaining of daily sub-period returns; XIRR with Newton–Raphson, bisection fallback, tolerance 1e-10; real return `(1+n)/(1+i)-1` — research R8) with unit tests against `apps/api/test/fixtures/returns-reference.json` (exported from `returns-reference.xlsx`), deviation ≤ 0.01 pp (SC-007)
- [ ] T029 [P] [US1] Add table `dashboard_layout` to `apps/api/src/database/schema.ts` with a migration (`widget_key` "PK; `networth`, `allocation`, `kpis`, `holdings`, `accounts`, `review`, `cashflow`, `budgets`"; `position` int; `visible` bool), seed the default order, and implement `GET/PUT /api/dashboard/layout` in `apps/api/src/modules/overview/layout.controller.ts` with e2e test
- [ ] T030 [US1] Implement `GET /api/overview/net-worth` in `apps/api/src/modules/overview/` (aggregate snapshots over `accounts` and `period`, `mode=value|return`, ≤ 400 points — research R13) with e2e test on the demo seed in `apps/api/test/e2e/overview-networth.e2e-spec.ts`
- [ ] T031 [US1] Add `GET /api/overview/allocation`, `GET /api/overview/kpis` (fields per contracts/http-api.md; `null` when not computable) and `GET /api/overview/holdings/top-flop` in `apps/api/src/modules/overview/` with e2e tests in `apps/api/test/e2e/overview-kpis.e2e-spec.ts`
- [ ] T032 [P] [US1] Implement `GET /api/accounts/tree` and `GET /api/accounts` in `apps/api/src/modules/accounts/` (depots/accounts groups with subtotals, reference accounts as children) and `GET /api/transactions/unreviewed/count` in `apps/api/src/modules/transactions/`; e2e tests
- [ ] T033 [US1] Build `apps/web/app/components/dashboard/NetWorthChart.vue` with Unovis (`VisXYContainer`, `VisArea`, `VisLine`, crosshair tooltip: net worth incl. cash & dividends, invested capital, cash), total + gain header, Vermögen/Rendite switch, `PeriodTabs`; component test
- [ ] T034 [P] [US1] Build `apps/web/app/components/dashboard/AllocationCard.vue` (donut, centre total, € / % toggle, legend by asset class) and `apps/web/app/components/dashboard/KpiCard.vue` (period select, rows per Story 1 scenario 6 with `InfoTooltip`); component tests
- [ ] T035 [P] [US1] Build `apps/web/app/components/dashboard/HoldingsCard.vue` (top/flop, range select), `AccountsCard.vue` (collapsible Depots/Konten, subtotals) and `ReviewBanner.vue` (unreviewed count, "Alle anzeigen" → `/budget/review`); component tests
- [ ] T036 [US1] Assemble `apps/web/app/pages/index.vue`: widgets in `dashboard_layout` order, all queries keyed by account filter + period, empty states (never `NaN`), "Anpassen" modal to reorder/hide widgets (FR-013); `CashflowCard` and `BudgetsCard` show empty states until US5
- [ ] T037 [US1] Add Playwright journey `e2e/us1-overview.spec.ts`: demo seed; total equals `demo-expected.json` to the cent; switch periods and Vermögen/Rendite; account filter; hide/reorder a widget; desktop + 360 px without horizontal scroll

**Checkpoint**: MVP — the overview works end to end on demo data.

---

## Phase 4: User Story 2 - Import data from CSV (Priority: P1)

**Goal**: Idempotent CSV import for Sparkasse and Scalable plus manual column mapping and manual entries.

**Independent Test**: Upload the Sparkasse and Scalable fixtures; data appears; re-upload imports 0 rows (quickstart V1–V4).

- [ ] T038 [P] [US2] Create synthetic fixtures in `apps/api/test/fixtures/csv/` (`sparkasse-camt-v8.csv` Windows-1252 `;` `DD.MM.YY`, `sparkasse-mt940.csv`, `scalable-transactions.csv` with `Savings plan`, `Distribution` and a non-executed row, `malformed.csv`, `unknown-layout.csv`) and `README.md` with expected counts and totals
- [ ] T039 [US2] Add tables `import_job` (`kind` "`csv_upload`, `sync`"; `status` "`running`, `succeeded`, `partial`, `failed`"; `errors` "`[{line, reason}]`, max 500 kept"), `csv_mapping` (`header_signature` "hash of normalized header row, unique"; `columns` json) and `categorization_rule` (`priority` "ascending, unique"; `match_field` "`counterparty`, `purpose`, `counterparty_iban`"; `operator` "`contains`, `equals`, `starts_with`, `regex`"; `pattern` "regex must compile"; `amount_sign` "`positive`, `negative`") to `apps/api/src/database/schema.ts` with a migration, and shared schemas `packages/shared/src/schemas/import.ts`
- [ ] T040 [US2] Implement CSV detection in `apps/api/src/modules/sources/csv/detector.ts` (UTF-8 → Windows-1252 fallback, delimiter sniffing `;`/`,`/`\t`, normalized header signature) with unit tests
- [ ] T041 [P] [US2] Implement Sparkasse parsers (`sparkasse-camt-v8`, `sparkasse-mt940`) in `apps/api/src/modules/sources/csv/sparkasse.ts` per contracts/csv-formats.md, with row errors `invalid_date`, `invalid_amount`; unit tests against fixtures
- [ ] T042 [P] [US2] Implement the Scalable parser in `apps/api/src/modules/sources/csv/scalable.ts` (types `Buy`, `Sell`, `Savings plan`, `Distribution`, `Interest`, `Deposit`, `Withdrawal`, `Fee`, `Taxes`, `Corporate action`; status ≠ `Executed` → `not_executed`; `reference` → `sourceRef`; errors `missing_isin`, `invalid_isin`, `missing_quantity`, `unknown_currency_no_rate`); unit tests
- [ ] T043 [P] [US2] Implement the generic mapped parser in `apps/api/src/modules/sources/csv/generic-mapped.ts` (required `date`, `amount`; date formats `DD.MM.YYYY`, `DD.MM.YY`, `YYYY-MM-DD`; decimal `,`/`.`; skip rows); unit tests
- [ ] T044 [US2] Implement `apps/api/src/domain/dedupe.ts` (fingerprint `sha256(accountId|bookingDate|amountCents|norm counterparty|norm purpose|occurrenceIndex)`, `(source, source_ref)` first — research R10) and `apps/api/src/domain/categorize.ts` (ordered rules, first match wins, never overwrite `manual`, own IBAN → `transfer` — research R11); unit tests incl. two identical same-day bookings
- [ ] T045 [US2] Implement `ImportPipeline` in `apps/api/src/modules/import/import.pipeline.ts`: upsert institutions/accounts/instruments/prices, dedupe, categorize, insert, `RecomputeService`, `import_job` counts/errors, one DB transaction, status `succeeded|partial|failed`; tests in `apps/api/test/e2e/import-pipeline.e2e-spec.ts` (SC-003)
- [ ] T046 [US2] Implement `CsvSource` and endpoints `POST /api/import/csv` (`@fastify/multipart`, 20 MB limit; returns `jobId`, `detectedFormat`, `needsMapping`, 10-row preview, headers), `POST /api/import/csv/:jobId/confirm`, `GET /api/import/jobs/:id`, `GET/POST/DELETE /api/csv-mappings` in `apps/api/src/modules/import/`; e2e tests for V1–V4
- [ ] T047 [P] [US2] Implement manual entries (FR-056): `POST/PATCH/DELETE /api/accounts` in `apps/api/src/modules/accounts/` (delete with transactions → 409 unless `?force=true`) and `POST /api/transactions` in `apps/api/src/modules/transactions/`; e2e tests
- [ ] T048 [US2] Build `apps/web/app/components/import/CsvUpload.vue` (`UFileUpload`, account select), `ColumnMapper.vue` (preview, field selects, options, "Zuordnung speichern"), `ImportResult.vue` (counts + errors with line numbers) and page `apps/web/app/pages/settings/sources.vue` listing data sources; component tests
- [ ] T049 [US2] Wire the header "Hinzufügen" menu in `apps/web/app/layouts/default.vue` to "CSV importieren", "Konto anlegen", "Transaktion erfassen" modals; component tests
- [ ] T050 [US2] Add Playwright journey `e2e/us2-csv-import.spec.ts` (Sparkasse upload, re-upload 0 new, malformed → partial, unknown layout mapping saved and auto-detected, overview total updates)

**Checkpoint**: Real data can be loaded; US1 works on it.

---

## Phase 5: User Story 3 - Sync my Scalable Capital depot (Priority: P2)

**Goal**: Read-only sync via Scalable's official MCP server.

**Independent Test**: Connect, sync, compare positions and the reference account with the Scalable app (quickstart V13–V14).

- [ ] T051 [US3] Implement the OAuth client provider in `apps/api/src/modules/sources/scalable-mcp/oauth-provider.ts` (MCP SDK `OAuthClientProvider`, dynamic client registration, PKCE + state server-side, tokens only via `CryptoService` in `data_source.encrypted_credentials`; redirect URI from env `SCALABLE_REDIRECT_URI`, default `http://localhost:3000/api/sources/scalable/callback`); unit tests with a mocked authorization server
- [ ] T052 [US3] Implement `apps/api/src/modules/sources/scalable-mcp/allowlist.ts` (explicit read-tool list; deny names/descriptions matching `order|trade|buy|sell|cancel|transfer|savings.?plan|withdraw`; `callTool` wrapper throws `ForbiddenToolError` before sending) with unit tests proving blocked tools never reach the transport (FR-054)
- [ ] T053 [US3] Implement `apps/api/src/modules/sources/scalable-mcp/client.ts` (`StreamableHTTPClientTransport` to `https://mcp.scalable.capital/mcp`, refresh once on 401 then `AuthExpiredError`, other failures `UpstreamError`, 30 s timeout) and `tools/list` discovery stored in `data_source.tool_manifest` with allowlist decisions; unit tests
- [ ] T054 [US3] With the owner's separate approval, connect once to the official Scalable Capital MCP service; the owner completes login and consent personally. Record `tools/list` and read-tool responses, anonymize them into `apps/api/test/fixtures/scalable-mcp/`, then finalize the allowlist in `apps/api/src/modules/sources/scalable-mcp/allowlist.ts`. If dynamic client registration is refused, report US3 as blocked and keep CSV available (research R3).
- [ ] T055 [US3] Implement `apps/api/src/modules/sources/scalable-mcp/mapper.ts` (tool results → `SyncBatch` incl. `positionsSnapshot`) and `ScalableMcpSource` in `apps/api/src/modules/sources/scalable-mcp/scalable-mcp.source.ts`; contract tests against the fixtures in `apps/api/test/unit/scalable-mapper.spec.ts`
- [ ] T056 [US3] Add `POST /api/sources/scalable/connect`, `GET /api/sources/scalable/callback`, `POST /api/sources/:id/sync` (202; 409 while running; 502 upstream), `DELETE /api/sources/:id`, `GET /api/sources` (never credentials) in `apps/api/src/modules/sources/sources.controller.ts`; positions mismatch → import-job warning; status transitions `active → needs_reauth → active`, any → `error`; e2e tests with a mocked MCP server
- [ ] T057 [P] [US3] Add the optional daily sync in `apps/api/src/modules/sources/sync.scheduler.ts` via `@nestjs/schedule`, off unless `SCALABLE_DAILY_SYNC=true`; unit test
- [ ] T058 [US3] Extend `apps/web/app/pages/settings/sources.vue` with the Scalable card ("Scalable Capital verbinden", status badge, last sync, "Synchronisieren", "Verbindung erneuern" on `needs_reauth`, "Trennen"); Playwright journey `e2e/us3-scalable.spec.ts` against the mocked MCP server

**Checkpoint**: The depot refreshes without CSV.

---

## Phase 6: User Story 4 - Investments tab (Priority: P2)

**Goal**: Positions, asset classes, position detail, investment transactions.

**Independent Test**: With demo data, open `/investments`, filter, hide a column, export (quickstart V8).

- [ ] T059 [US4] Implement `GET /api/investments/performance`, `GET /api/investments/positions` (`status=open|sold`, `assetClass`; columns per Story 4 scenario 2; sold rows with `realizedCents`) and `GET /api/investments/asset-classes` in `apps/api/src/modules/investments/`; e2e tests on the demo seed
- [ ] T060 [P] [US4] Implement `GET /api/investments/positions.csv` (`;`, de-DE decimals, UTF-8 BOM, requested columns only), `GET /api/investments/instruments/:id` and `GET /api/investments/transactions` (paging, type filter) in `apps/api/src/modules/investments/`; e2e tests
- [ ] T061 [US4] Build `apps/web/app/components/investments/PerformanceChart.vue` (value vs. invested, € / %, `PeriodTabs`), `PositionsTable.vue` (`UTable`, asset chips, column visibility, Export, collapsible "Verkaufte Investments") and `AssetClassTable.vue`; component tests
- [ ] T062 [US4] Build `apps/web/app/pages/investments/index.vue` (Positionen / Assetklassen), `apps/web/app/pages/investments/transactions.vue`, `apps/web/app/pages/investments/[instrumentId].vue`; link the overview holdings and accounts cards to them
- [ ] T063 [US4] Add Playwright journey `e2e/us4-investments.spec.ts` (filter ETF, hide a column, export has visible columns only, open a position, sold section)

---

## Phase 7: User Story 5 - Budget / cash-flow analysis (Priority: P2)

**Goal**: Period analysis, Sankey, categories, review, rules, budgets.

**Independent Test**: With demo data, open `/budget`; figures, 12 bars, Sankey and categories are consistent (quickstart V9–V11).

- [ ] T064 [US5] Implement `apps/api/src/domain/cashflow.ts` (aggregates per month/quarter/year; transfers excluded; investment purchases count as "Gespart"; savings rate = saved / income; 12 bars ending at the anchor; Sankey income → main → sub) with unit tests (FR-030, FR-032)
- [ ] T065 [US5] Implement `GET /api/cashflow/summary`, `/sankey`, `/categories` in `apps/api/src/modules/cashflow/` and `GET /api/transactions` (filters `categoryId`, `status`, `q`, paging) + `PATCH /api/transactions/:id` (`categoryId`, `reviewStatus`, `type`, optional `createRule`) in `apps/api/src/modules/transactions/`; e2e tests
- [ ] T066 [P] [US5] Implement category CRUD (delete of `is_default` → 409; "max depth 2"; "unique within parent") and rule CRUD (`priority` "ascending, unique"; `pattern` "regex must compile") plus `POST /api/rules/apply` in `apps/api/src/modules/categories/`; e2e tests
- [ ] T067 [P] [US5] Add table `budget` to `apps/api/src/database/schema.ts` with a migration (`category_id` "unique; expense kind only"; `monthly_limit_cents` "> 0") and implement CRUD with `spentCents`/`remainingCents` for the current month in `apps/api/src/modules/budgets/`; e2e tests
- [ ] T068 [US5] Build `apps/web/app/components/budget/PeriodSwitcher.vue` (prev/next, "Aktueller Monat", Monat/Quartal/Jahr), `CashflowBars.vue` (grouped bar, current period hatched), summary tiles (Einnahmen, Ausgaben, Saldo, Gespart, Sparquote), `SankeyChart.vue` (€ / %), `CategoryList.vue` (Ausgaben/Einnahmen, counts, totals, donut, drill-down); component tests
- [ ] T069 [US5] Build `apps/web/app/pages/budget/index.vue` (Analyse), `apps/web/app/pages/budget/review.vue` (category select, "Regel speichern", ≤ 2 clicks per row — SC-005), `apps/web/app/pages/budget/budgets.vue`, `apps/web/app/pages/settings/categories.vue`; fill `apps/web/app/components/dashboard/CashflowCard.vue` and `BudgetsCard.vue` on the overview
- [ ] T070 [US5] Add Playwright journey `e2e/us5-budget.spec.ts` (Monat/Quartal/Jahr, step back, categorize with rule, count drops, budget Lebenshaltung 500 € visible on the overview)

---

## Phase 8: User Story 6 - Insurance contracts (Priority: P3)

**Goal**: Manual insurance contract list.

**Independent Test**: Add a term-life contract at 23,62 € monthly; yearly cost shows 283,44 € (quickstart V12).

- [ ] T071 [US6] Add table `insurance_contract` to `apps/api/src/database/schema.ts` with a migration (`type` "`health`, `term_life`, `liability`, `household`, `disability`, `car`, `legal`, `other`"; `premium_cents` "> 0"; `interval` "`monthly`, `quarterly`, `semiannual`, `annual`"; `end_date` "≥ start_date"; `notes` "≤ 2000"; `linked_category_id` optional) and implement CRUD with derived `yearlyCostCents = premium × {12,4,2,1}` in `apps/api/src/modules/insurance/`; e2e tests
- [ ] T072 [US6] Build `apps/web/app/components/insurance/ContractForm.vue`, `ContractList.vue` and `apps/web/app/pages/insurance/index.vue` (empty state "Versicherung hinzufügen", edit, delete with confirm); Playwright journey `e2e/us6-insurance.spec.ts`

---

## Phase 9: User Story 7 - Sparkasse bank query slot (Priority: P3, later)

**Goal**: Reserve the Sparkasse live-query source without functionality.

**Independent Test**: Datenquellen shows "Sparkasse (Live-Abfrage) – geplant", not activatable (quickstart V15).

- [ ] T073 [US7] Implement the placeholder `apps/api/src/modules/sources/sparkasse-fints/sparkasse-fints.source.ts` (`status()` → `planned`, `fetch` throws `NotImplementedError`), register it in `SourcesRegistry`, and show a disabled "geplant" card in `apps/web/app/pages/settings/sources.vue`; unit + component tests

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Quality across all stories, then local container testing and a portable deployment kit. Live rollout is out of scope.

- [ ] T074 [P] Responsive and theme pass over all pages at 360 px, tablet and desktop in dark/light; `e2e/responsive.spec.ts` asserts no horizontal scroll on every tab (SC-006)
- [ ] T075 [P] Performance: generator `apps/api/src/database/perf-seed.ts` for 5 years daily history + 10k transactions; add missing indexes; measure `/` < 2 s (SC-002) and 50k-row CSV import < 30 s; record results in `specs/001-wealth-tracker-dashboard/quickstart.md`
- [ ] T076 [P] Security hardening: `@fastify/helmet` in `apps/api/src/main.ts`, CSP headers in `apps/web/nuxt.config.ts`, check credentials never appear in responses or logs, upload limits, `pnpm audit` without high/critical findings
- [ ] T077 [P] Write `README.md` (setup, scripts, architecture, data sources, privacy note) and `apps/api/README.md` / `apps/web/README.md`
- [ ] T078 Run quickstart V1–V18 locally with `pnpm dev`, then the local container test (`compose.local.yaml`, V19) and fix regressions; record the results in `specs/001-wealth-tracker-dashboard/quickstart.md`
- [ ] T079 Create the image-only `deploy/compose.yaml` and `deploy/.env.example`: default image prefix `ghcr.io/tobiaswaelde/finanzguru-clone`, configurable `FINANCE_IMAGE_PREFIX` and `FINANCE_TAG`, one standard bridge with API egress, web host port bound to loopback by default, no API host port, `./data/api:/data` bind mount, `.env` for secrets, and health checks. Validate with Compose and placeholder settings (V21).
- [ ] T080 [P] Add `deploy/backup.sh` for an online, consistent SQLite copy of `data/api/app.db` to `data/api/backup/` with seven-day retention and no host-specific paths; verify the backup opens successfully on a disposable database.
- [ ] T081 Add a non-publishing V21 gate to `.github/workflows/ci.yml` that validates `deploy/compose.yaml` with example settings and checks the rendered image references, bind mount, loopback web binding, and absence of an API port.
- [ ] T082 Add `deploy/test-backup.sh` to exercise restore, data integrity, and retention using disposable SQLite data; wire it into `.github/workflows/ci.yml` without modifying host data.
- [ ] T083 Write `deploy/README.md` covering GHCR authentication, pinned image updates and rollback, owner password setup, loopback/TLS guidance, daily backup scheduling, restore, and post-release V20/V22. Verify pre-release steps locally and mark V20/V22 pending until both images have been published by a separately approved release. Do not perform a live rollout.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. T001 first; T002–T004 and T006–T008 in parallel; T005 after T002–T004; T009 after T003/T004; T010 after T009; T011 after T009.
- **Foundational (Phase 2)**: after Setup; blocks all stories. T012 → T013 → (T022, T023) → T024; T014, T015, T017, T019, T020 in parallel; T016 → T018; T021 → T022; T025 → (T026, T027).
- **US1 (P1)**: after Foundational (demo data).
- **US2 (P1)**: after Foundational; its E2E checks the overview total, so finish US1 first when working sequentially.
- **US3 (P2)**: needs T045 (ImportPipeline) and T048 (sources page).
- **US4 (P2)**: after Foundational; independent of US2/US3.
- **US5 (P2)**: needs T039 (rules table) and T044 (categorize); fills the overview cards from US1.
- **US6 (P3)**: after Foundational.
- **US7 (P3)**: needs T048 (sources page).
- **Polish (Phase 10)**: after all chosen stories. T078 (local test) blocks T079–T083; T081 needs T011 and T079; T082 needs T080 and follows T081 to avoid concurrent edits to CI; T083 follows T081 and T082.

### User Story Dependencies

```text
Foundational ─┬─ US1 ─────────────┐
              ├─ US2 ─┬─ US3      │
              │       ├─ US5 ─────┤ (fills US1 cards)
              │       └─ US7      │
              ├─ US4              │
              └─ US6              │
                              └─ Polish → local container test → portable deployment kit
```

### Within Each User Story

Schema/migration → domain → controller/service with e2e tests → UI components with component tests → page assembly → Playwright journey.

### Parallel Opportunities

- Setup: T002, T003, T004, T006, T007, T008 (then T009, T011)
- Foundational: T014, T015, T017, T019, T020; later T026, T027
- After Foundational: US1, US4 and US6 can run alongside each other; US2 alongside US1
- Polish: T074–T077 where files do not overlap; after T078, T079 and T080 can run in parallel.

## Parallel Examples per User Story

```text
US1: T028 returns.ts | T029 dashboard_layout | T032 accounts tree; then T034 AllocationCard/KpiCard | T035 Holdings/Accounts/Review
US2: T038 fixtures | T041 sparkasse.ts | T042 scalable.ts | T043 generic-mapped.ts | T047 manual entries
US3: T057 sync.scheduler.ts alongside T055 mapper.ts
US4: T060 positions.csv + instrument detail alongside T061 UI components
US5: T066 categories/rules | T067 budgets (after T064/T065 start)
US6: T071 API before T072 UI (sequential)
US7: T073 single task
```

## Implementation Strategy

### MVP First

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 US1 on demo data → validate V5–V7
3. Phase 4 US2 → validate V1–V4 with own CSV exports → usable MVP on own data

### Incremental Delivery

US3 → US4 → US5 → US6 → US7 → Polish. Each story is validated by its quickstart scenarios and Playwright journey before the next one starts.

### Release Flow

Develop locally (`pnpm dev`) → local container test (`compose.local.yaml`, T078) → validate the portable kit (T079–T083). After a separately approved release, verify GHCR publication and pull-based startup and persistence in a disposable environment (V20/V22). Do not let post-release evidence block review of the implementation PR.

## Notes

- Each task = one commit referencing its task ID and issue #1; push right after each commit.
- Run the applicable checks before each task commit. During bootstrap, record which gates do not exist yet and run the full configured suite once the tooling and smoke tests are in place.
- Never commit real personal exports, recorded tokens or `.env` files; MCP fixtures are anonymized.
- The Scalable integration never calls order-related tools (T052 enforces this in code).
- No live host, ingress, external network, backup schedule, or package visibility changes are authorized by these tasks.
