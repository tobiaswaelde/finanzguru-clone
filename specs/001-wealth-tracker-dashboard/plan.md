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

**Target Platform**: Local development with Node 26 and pnpm, evergreen browsers, and Docker Compose. GitHub Actions builds `ghcr.io/tobiaswaelde/finanzguru-clone-web` and `ghcr.io/tobiaswaelde/finanzguru-clone-api`. A portable template runs the published images; no live host is part of this delivery.

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
├── compose.yaml              # portable, image-only stack template
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
3. **US1 Overview (P1)** with demo data, then **US2 CSV import (P1)** with an end-to-end test that checks the imported total in the overview.
4. **US3 Scalable MCP (P2)**, **US4 Investments (P2)**, **US5 Budget (P2)**.
5. **US6 Insurance (P3)**, **US7 Sparkasse slot (P3)**.
6. **Polish**: responsive pass, dark/light, empty states, E2E, performance check against SC-002.
7. **Containerization & deployment**: Local source-built container test, GHCR release workflow, portable image-only Compose template, and backup tooling. Validate the template locally; verify actual image publication and pull-based persistence after a separately approved release. No live rollout.

## Integration Checks

- API: verify agreement among shared schemas, Nest validation, OpenAPI, and Nuxt consumers. Exercise unauthenticated access and resource filters.
- SQLite: test migrations from an empty database and upgrades from the prior schema on disposable copies; verify rows and constraints without touching live data.
- Vue: verify German copy and formats, loading/empty/error states, keyboard access, dark/light themes, and desktop and 360 px layouts.

## Risks

| Risk | Mitigation |
|------|------------|
| Scalable MCP tool names/schemas unknown until connected | Discover via `tools/list` at connect time; map through `modules/sources/scalable-mcp/mapper.ts`; strict read-only allowlist; contract tests with recorded fixtures. |
| Scalable MCP OAuth flow for a non-chat client | MCP SDK OAuth client provider with dynamic client registration + PKCE; fall back to CSV if registration is refused (research R3). |
| Real CSV layouts change | Header-based detection + saved manual mappings; fixtures per known layout version. |
| Return math errors | Property tests + reference spreadsheet dataset (SC-007). |
| Personal financial data in repo | Fixtures are synthetic/anonymized; `apps/api/data/` and `.env` git-ignored. |
| Two processes in dev/prod | Root `pnpm dev` runs both in parallel; `docker-compose.yml` optional; web reads `API_BASE_URL`. |
| Session and OAuth on a deployed host | Default to loopback. Document secure cookies and an HTTPS OAuth callback for non-loopback deployments. If the broker rejects a development callback, keep CSV available and report the live-sync validation gap. |
| `better-sqlite3` native module in image | Build in a `node:26-bookworm-slim` builder with build tools, copy `node_modules` into the same base for runtime. |
| Contract drift web ↔ api | Both import zod schemas from `packages/shared`; Swagger generated from the same schemas. |

## Deployment

Build and test with `compose.local.yaml` first. The release workflow derives the lowercase GHCR namespace from the repository on `main` and version tags. Use its published images in `deploy/compose.yaml`:

- Use a standard Compose bridge, no external network, and allow API egress for the read-only MCP client. Publish only the web port, on `127.0.0.1` by default.
- Default image names to the fork's GHCR namespace. Allow operators to set the image prefix and tag; document pinning a version for repeatable updates and rollback.
- Bind-mount `./data/api:/data`, load secrets from a git-ignored `.env` with an example containing only placeholders, and include service health checks.
- Validate Compose configuration before review. Verify image publication and pull-based startup, login, and persistence on a disposable host or stack after the separately approved release. Document private-package pull credentials, reverse proxy setup, backup and restore without performing a live rollout.

## Complexity Tracking

No constitution violations to justify.
