# Implementation Plan: Personal Wealth Tracker Dashboard

**Branch**: `1-personal-wealth-tracker-dashboard-overview-investments-budget-insurance` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-wealth-tracker-dashboard/spec.md`

## Summary

Build a self-hosted, single-user wealth tracker with four tabs (Übersicht, Investments, Budget, Versicherung) that reproduces the functional scope of the reference tool under its own branding. A pnpm monorepo holds a Nuxt 4 frontend (Nuxt UI v4) and a NestJS 11 backend API, both strict TypeScript on Node 26, plus a shared package for zod schemas and DTO types. Nuxt proxies `/api/**` to NestJS so the session cookie stays same-origin. Data lives in a local SQLite database via Drizzle ORM, accessed only by the backend. Data enters through a common `DataSource` interface with two implementations in this feature — CSV import (Scalable Capital, Sparkasse, custom mappings) and a read-only Scalable Capital MCP client — and a reserved, inactive Sparkasse bank-query slot. A pure TypeScript domain layer derives positions, daily net-worth snapshots, returns (TWROR, IRR), cash-flow aggregates and budgets; charts render with Unovis.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 26.x (`engines.node: ">=26 <27"`, `.nvmrc`)

**Primary Dependencies**:
- Frontend (`apps/web`): Nuxt 4, `@nuxt/ui` v4 (Tailwind CSS v4, Reka UI), `@unovis/vue` (area/line, donut, grouped bar, Sankey), `@nuxtjs/i18n` (de default). The frontend has no server logic; Nitro only proxies `/api/**`.
- Backend (`apps/api`): NestJS 11 (`@nestjs/platform-fastify`), `nestjs-zod` (shared zod schemas as DTOs + OpenAPI), `@nestjs/swagger`, `@nestjs/schedule` (optional periodic sync), `@fastify/secure-session` (sealed cookie session), `@fastify/multipart` (CSV upload), Drizzle ORM + `better-sqlite3`, `@modelcontextprotocol/sdk` (Streamable HTTP client + OAuth), `papaparse`, `decimal.js`, `nestjs-pino`.
- Shared (`packages/shared`): zod schemas, DTO types, enums, de-DE format helpers.

**Storage**: SQLite file (`apps/api/data/app.db`) via Drizzle; migrations with `drizzle-kit`; connection secrets AES-256-GCM encrypted with `API_ENCRYPTION_KEY`

**Testing**: Vitest across workspaces (backend via `unplugin-swc` for decorator metadata): domain math, CSV parsers, Nest module tests with `@nestjs/testing`, HTTP e2e with Fastify `inject`; `@nuxt/test-utils` for components; Playwright (E2E for P1 stories, 360 px + desktop); ESLint; `vue-tsc --noEmit` / `tsc --noEmit`

**Target Platform**: Local development on Windows (Node 26, `pnpm dev`), then Docker: two images `ghcr.io/mfurti/finanzguru-clone-web` and `ghcr.io/mfurti/finanzguru-clone-api` built by GitHub Actions; production on the homelab server `rocky` (Rocky Linux, Docker Engine 29, Compose v5) in `/root/docker/finance-clone/compose.yaml`, web reachable at `192.168.178.36` (macvlan `FRITZBOX`); evergreen browsers

**Project Type**: Web application, pnpm monorepo (frontend + backend + shared package)

**Performance Goals**: Overview fully rendered < 2 s with 5 years daily history + 10k transactions (SC-002); CSV import of 50k rows < 30 s without blocking the UI

**Constraints**: Single owner; data stays on host, no telemetry (FR-062); data sources read-only — no order tools invoked (FR-054); money stored as integer cents, quantities/prices as decimal strings; de-DE formatting; mobile 360 px without horizontal scroll

**Scale/Scope**: 1 user, ≈ 10 accounts, ≈ 200 instruments, ≈ 50k transactions, 4 tabs / ≈ 10 screens, ≈ 15 entities

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled Spec Kit template (no ratified principles). There are no project gates to evaluate.

| Gate | Status | Note |
|------|--------|------|
| Project constitution principles | N/A | Template only; run `/speckit-constitution` to ratify principles. |
| Default quality bar applied instead | PASS | Strict TS, lint, typecheck, unit + E2E tests per user story, read-only data sources, encrypted secrets. |

**Post-design re-check**: PASS (no constitution gates). Two apps plus one shared package is the user's explicit choice (NestJS backend). Beyond that, the only abstraction is the `DataSource` interface that FR-055 requires.

## Project Structure

### Documentation (this feature)

```text
specs/001-wealth-tracker-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── http-api.md      # NestJS REST endpoints
│   ├── data-source.md   # DataSource interface (CSV, Scalable MCP, Sparkasse slot)
│   └── csv-formats.md   # Supported CSV layouts + mapping contract
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
package.json                  # pnpm workspace root: scripts dev/lint/typecheck/test/test:e2e/docker:local
pnpm-workspace.yaml
.nvmrc                        # 26
.dockerignore
compose.local.yaml            # local container test: build both images from source, data in ./data-local
deploy/
├── compose.yaml              # server stack template → /root/docker/finance-clone/compose.yaml
├── .env.example              # FINANCE_TAG, API secrets placeholders (no values)
├── backup.sh                 # SQLite online backup, 7 days
└── README.md                 # rollout + update + rollback steps
.github/workflows/
├── ci.yml                    # lint, typecheck, tests, Playwright
└── release.yml               # build + push both images to ghcr.io on main/tags
apps/
├── web/                      # Nuxt 4 + Nuxt UI (frontend only)
│   ├── nuxt.config.ts        # routeRules: '/api/**' → proxy to API_BASE_URL
│   ├── app/
│   │   ├── app.vue
│   │   ├── app.config.ts     # Nuxt UI theme (own brand colors)
│   │   ├── assets/css/main.css
│   │   ├── layouts/default.vue   # header, tab nav, global account filter
│   │   ├── middleware/auth.global.ts
│   │   ├── pages/
│   │   │   ├── index.vue             # Übersicht
│   │   │   ├── login.vue
│   │   │   ├── investments/{index,transactions,[instrumentId]}.vue
│   │   │   ├── budget/{index,budgets,review}.vue
│   │   │   ├── insurance/index.vue
│   │   │   └── settings/{sources,categories}.vue
│   │   ├── components/
│   │   │   ├── dashboard/    # NetWorthChart, AllocationCard, KpiCard, HoldingsCard,
│   │   │   │                 # AccountsCard, ReviewBanner, CashflowCard, BudgetsCard
│   │   │   ├── investments/  # PositionsTable, AssetClassTable, PerformanceChart
│   │   │   ├── budget/       # PeriodSwitcher, CashflowBars, SankeyChart, CategoryList
│   │   │   ├── insurance/    # ContractForm, ContractList
│   │   │   ├── import/       # CsvUpload, ColumnMapper, ImportResult
│   │   │   └── common/       # Money, Percent, PeriodTabs, EmptyState, AccountFilter
│   │   └── composables/      # useApi (typed $fetch), useAccountFilter, usePeriod, useDashboardLayout
│   └── tests/                # component tests (@nuxt/test-utils)
└── api/                      # NestJS 11 (Fastify adapter)
    ├── src/
    │   ├── main.ts           # global prefix 'api', secure-session, multipart, ZodValidationPipe, Swagger at /api/docs
    │   ├── app.module.ts
    │   ├── config/           # env schema (zod), ConfigModule
    │   ├── database/         # DrizzleModule (provider), schema.ts, migrations/, seed.ts
    │   ├── common/           # crypto.service (AES-GCM), money, guards/session.guard, filters
    │   ├── domain/           # pure TS, no Nest imports
    │   │   ├── positions.ts  # FIFO lots, avg price, realized/unrealized gains, splits
    │   │   ├── snapshots.ts  # daily net worth / invested / cash
    │   │   ├── returns.ts    # TWROR, IRR (XIRR), real return
    │   │   ├── cashflow.ts   # period aggregates, savings rate, Sankey nodes/links
    │   │   ├── categorize.ts # rule engine
    │   │   └── dedupe.ts     # transaction fingerprinting
    │   └── modules/          # one Nest module per bounded area (controller + service)
    │       ├── auth/
    │       ├── overview/
    │       ├── accounts/
    │       ├── investments/
    │       ├── transactions/
    │       ├── cashflow/
    │       ├── categories/   # categories + rules
    │       ├── budgets/
    │       ├── insurance/
    │       ├── settings/
    │       ├── import/       # ImportPipeline (persist, dedupe, categorize, recompute), CSV upload/confirm, jobs
    │       └── sources/
    │           ├── data-source.interface.ts
    │           ├── sources.registry.ts
    │           ├── csv/              # detector, scalable, sparkasse, generic-mapped
    │           ├── scalable-mcp/     # client, oauth-provider, mapper, allowlist
    │           └── sparkasse-fints/  # placeholder: status "planned"
    └── test/
        ├── unit/             # domain + parsers
        ├── e2e/              # Nest app + Fastify inject per controller
        └── fixtures/{csv,scalable-mcp}/
packages/
└── shared/                   # zod schemas, DTO types, enums, format helpers (de-DE)
e2e/                          # Playwright per user story (runs web + api)
apps/web/Dockerfile           # multi-stage, node:26-bookworm-slim, .output, non-root, port 3000
apps/api/Dockerfile           # multi-stage, node:26-bookworm-slim, pnpm deploy --prod, non-root, port 3001
```

**Structure Decision**: pnpm monorepo with `apps/web` (Nuxt UI frontend), `apps/api` (NestJS backend) and `packages/shared` (contract schemas used by both). The frontend never touches the database or secrets. Nitro's proxy keeps `/api` same-origin, so the session cookie needs no CORS. The domain layer in `apps/api/src/domain/` is framework-free for fast unit tests. Data sources implement one interface in `modules/sources/` so Sparkasse FinTS can be added later (FR-055) without touching UI or domain code.

## Phase Overview (for task generation)

1. **Setup**: pnpm workspace, Node 26 pin, `apps/api` NestJS (Fastify) scaffold, `apps/web` Nuxt 4 + Nuxt UI scaffold with `/api` proxy, `packages/shared`, lint/typecheck/test tooling, Drizzle + SQLite, session auth, brand theme, layout + tabs.
2. **Foundation**: schema + migrations, shared zod schemas, money/format utils, DataSource interface + ImportPipeline, default categories, demo seed, Swagger.
3. **US2 CSV import (P1)** → **US1 Overview (P1)**: domain math (positions, snapshots, returns, cashflow) + all overview widgets.
4. **US3 Scalable MCP (P2)**, **US4 Investments (P2)**, **US5 Budget (P2)**.
5. **US6 Insurance (P3)**, **US7 Sparkasse slot (P3)**.
6. **Polish**: responsive pass, dark/light, empty states, E2E, performance check against SC-002.
7. **Containerization & deployment**: Dockerfiles, `compose.local.yaml`, local container test, release workflow to GHCR, `deploy/compose.yaml` per server compose style, rollout to `/root/docker/finance-clone` only after the local test passed and with Max's OK for every server command.

## Risks

| Risk | Mitigation |
|------|------------|
| Scalable MCP tool names/schemas unknown until connected | Discover via `tools/list` at connect time; map through `modules/sources/scalable-mcp/mapper.ts`; strict read-only allowlist; contract tests with recorded fixtures. |
| Scalable MCP OAuth flow for a non-chat client | MCP SDK OAuth client provider with dynamic client registration + PKCE; fall back to CSV if registration is refused (research R3). |
| Real CSV layouts change | Header-based detection + saved manual mappings; fixtures per known layout version. |
| Return math errors | Property tests + reference spreadsheet dataset (SC-007). |
| Personal financial data in repo | Fixtures are synthetic/anonymized; `apps/api/data/` and `.env` git-ignored. |
| Two processes in dev/prod | Root `pnpm dev` runs both in parallel; `docker-compose.yml` optional; web reads `API_BASE_URL`. |
| Plain HTTP at `192.168.178.36` | `secure` session cookie and the Scalable OAuth redirect need HTTPS: `COOKIE_SECURE` is configurable (false on plain LAN HTTP). If Scalable rejects an `http://192.168.178.36` redirect URI, add a Traefik router `finance.mfurti.de` (`entrypoints=websecure`, `certresolver=netcup`, `secured@file`) — open decision for Max. |
| macvlan host isolation | The host cannot reach `.36` without a `macvlan-shim` route; not needed for LAN clients. Adding the route only after asking. |
| `better-sqlite3` native module in image | Build in a `node:26-bookworm-slim` builder with build tools, copy `node_modules` into the same base for runtime. |
| Contract drift web ↔ api | Both import zod schemas from `packages/shared`; Swagger generated from the same schemas. |

## Deployment

Flow: develop locally (`pnpm dev`) → test locally in containers (`compose.local.yaml`) → push to `main` → GitHub Actions publishes images to GHCR → server pulls images in `/root/docker/finance-clone/`. Source code never lives on the server.

Server stack `/root/docker/finance-clone/compose.yaml` follows `/root/docker/AGENTS.md` ("Verbindlicher Compose-Stil", 22.11.2026) and mirrors the `habit-tracker` stack:

- Top-level order `name: finance-clone`, `networks`, `services`; extra blocks after `services`.
- Networks: `FRITZBOX` (external macvlan), `traefik-public` (external, written as `traefik-public: {}` on the web service), `finance-internal` (own bridge for web ↔ api; not `internal`, because the API needs outbound HTTPS to `mcp.scalable.capital`).
- `finance-web`: `image: ghcr.io/mfurti/finanzguru-clone-web:${FINANCE_TAG:-latest}`, `FRITZBOX` with `ipv4_address: 192.168.178.36` and a fixed locally administered `mac_address` (`6e:46:43:4c:00:36`), plus `finance-internal`; `API_BASE_URL=http://finance-api:3001`.
- `finance-api`: `image: ghcr.io/mfurti/finanzguru-clone-api:${FINANCE_TAG:-latest}`, only `finance-internal`; `env_file: .env` for `API_SESSION_SECRET`, `API_ENCRYPTION_KEY` (never in compose); bind mount `./data/api:/data` (no named or anonymous volumes; the image declares no `VOLUME`).
- Both: `container_name`, `restart: unless-stopped`, `json-file` logging 10m × 3, `TZ: Europe/Berlin`, healthchecks (`/api/health`).
- Server-side changes (creating the folder, `.env`, `docker compose pull/up`, `AGENTS.md` IP table + stack table, `README.md`, crontab entry for `backup.sh`, commits in `mfurti/homelab-rocky`) are each asked for first, as `AGENTS.md` requires.

## Complexity Tracking

No constitution violations to justify.
