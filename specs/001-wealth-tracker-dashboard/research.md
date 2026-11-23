# Research: Personal Wealth Tracker Dashboard

All Technical Context items are resolved; no `NEEDS CLARIFICATION` remains.

## R1 — Framework and UI kit

- **Decision**: Frontend: Nuxt 4 with `@nuxt/ui` v4, without server logic. Backend: NestJS 11 on the Fastify adapter as a separate app. Both live in one pnpm monorepo with `packages/shared`.
- **Rationale**: The user asked for Nuxt UI, TypeScript and NestJS for the backend. Nuxt UI v4 ships the needed primitives (`UTabs`, `UTable`, `UCard`, `USelect`, `UModal`, `UFileUpload`, `UDashboard*` layout, color mode). NestJS gives modules per domain area, DI for data sources and the import pipeline, guards, and Swagger. The MCP client, DB and secrets live only in the API.
- **Web ↔ API wiring**: Nuxt `routeRules: { '/api/**': { proxy: `${API_BASE_URL}/api/**` } }`. The browser talks only to the Nuxt origin, so the cookie is same-origin and no CORS is needed. SSR requests forward the cookie via `useRequestFetch`.
- **Fastify vs Express adapter**: Fastify is faster, and `@fastify/secure-session` plus `@fastify/multipart` cover sessions and uploads. Express would work equally well; it is not chosen to avoid `express-session` plus a store.
- **Alternatives considered**: Nitro server routes only (previous plan) — replaced by the user's NestJS requirement. Nx monorepo — more tooling than two apps need.

## R2 — Runtime: Node 26

- **Decision**: Pin `engines.node` to `>=26 <27`, add `.nvmrc` with `26`, and CI uses Node 26.
- **Rationale**: User requirement. Node 26 is the current release line in late 2026. Nuxt 4 and NestJS 11 support current Node majors.
- **Note**: `better-sqlite3` needs a prebuilt binary for Node 26 ABI. If none exists yet, install falls back to node-gyp (needs build tools). Alternative: built-in `node:sqlite`, which Drizzle does not support out of the box. Verify during setup task; keep DB access behind `apps/api/src/database/` (DrizzleModule provider).

## R3 — Scalable Capital data access

- **Decision**: Use Scalable's official remote MCP server (`https://mcp.scalable.capital/mcp`) via `@modelcontextprotocol/sdk` `Client` + `StreamableHTTPClientTransport`, with the SDK's OAuth client provider (authorization code + PKCE, dynamic client registration). The owner completes login in Scalable's own page; the app stores the token set AES-GCM encrypted.
- **Rationale**: Official, supported channel; Scalable advises users to do the login themselves, which matches FR-053. Using MCP as a plain API client avoids any LLM in the loop.
- **Read-only enforcement**: At connect time call `tools/list`, then keep a static allowlist of read tools (portfolio/positions, transactions, cash/balances, instrument prices). Any tool whose name or description indicates order, trade, buy, sell, cancel, transfer or savings-plan modification is blocked in `allowlist.ts` regardless of the server's own approval step (FR-054).
- **Unknowns handled in implementation**: Exact tool names and result schemas are discovered on first connection. `mapper.ts` translates them into domain entities, and recorded responses become contract-test fixtures. If dynamic client registration is refused for third-party clients, Scalable sync is disabled with a notice and CSV remains the source. This is a blocker, not a silent fallback.
- **Alternatives considered**: Community MCP wrappers around Scalable's CLI — unofficial, not endorsed. Scalable's CLI (`scCLI`) invoked as a subprocess — possible fallback, but needs a local CLI login. Screen-scraping — rejected.
- **Sources**: [Scalable — MCP & CLI for AI agents](https://es.scalable.capital/en/agentic-investing), [Finance Magnates coverage](https://www.financemagnates.com/fintech/scalable-capital-rolls-out-ai-agent-integration-for-portfolio-analysis-and-trading/), [IT Finanzmagazin](https://www.it-finanzmagazin.de/scalable-capital-oeffnet-seine-brokerage-plattform-fuer-ki-assistenten-249755/)

## R4 — Sparkasse

- **Decision**: CSV now (Sparkasse online banking "CSV-CAMT" / "CSV-MT940" export). Live query deferred; reserve a `sparkasse-fints` source with status `planned`.
- **Rationale**: Owner deferred it. FinTS/HBCI (e.g. `lib-fints` in TS, or `python-fints`) or a PSD2 aggregator are the later options; both need SCA/TAN handling that warrants its own spec.

## R5 — Persistence

- **Decision**: SQLite file + Drizzle ORM + `drizzle-kit` migrations.
- **Rationale**: One user, about 50k rows. Zero-ops, file-based backup, fast aggregates with indexes on `(account_id, booking_date)`.
- **Alternatives considered**: PostgreSQL — unnecessary ops. JSON files — no query power, harder idempotency.

## R6 — Money and number handling

- **Decision**: Amounts in integer cents (`INTEGER`); quantities and prices as decimal strings, computed with `decimal.js`; EUR only in storage (foreign amounts converted at import when the rate is in the file).
- **Rationale**: Avoids float drift; SC-001 and SC-004 require cent accuracy.

## R7 — Charts

- **Decision**: `@unovis/vue` (VisXYContainer + VisArea/VisLine, VisGroupedBar, VisSingleContainer + VisDonut, VisSankey), styled via CSS variables from Nuxt UI tokens.
- **Rationale**: One library covers all four chart types including Sankey. It is the library Nuxt UI's own dashboard examples use, so it themes cleanly in dark/light.
- **Alternatives considered**: ECharts (heavier, own theming), Chart.js (no native Sankey), ApexCharts (no Sankey).

## R8 — Return calculations

- **Decision**:
  - **TWROR**: Chain daily sub-period returns `r_t = (V_t − F_t) / V_{t−1} − 1`, where `F_t` is the external flow on day t (deposits, withdrawals, buys, sells at the depot/cash boundary); product over the period minus 1.
  - **IRR (IZF)**: XIRR over dated external flows plus start value (negative) and end value (positive); Newton–Raphson with bisection fallback; tolerance 1e-10.
  - **Real return**: `(1 + nominal) / (1 + inflation) − 1`, with the configurable inflation rate.
- **Rationale**: Standard definitions. Validated against a reference spreadsheet fixture (SC-007).

## R9 — Position accounting

- **Decision**: FIFO lots per instrument and depot. Realized gain on sell = proceeds − FIFO cost basis. Average entry price is shown as the weighted average of open lots. Splits are applied as a quantity factor to open lots.
- **Rationale**: FIFO matches German tax treatment (§ 20 Abs. 4 EStG) and broker statements.

## R10 — Deduplication and idempotent import

- **Decision**: `fingerprint = sha256(accountId | bookingDate | amountCents | normalized counterparty | normalized purpose | occurrenceIndex)` with a unique index. Source-provided IDs (Scalable transaction id) go in `source_ref` with a unique `(source, source_ref)` index, which takes precedence.
- **Rationale**: Satisfies SC-003 and the cross-source edge case; `occurrenceIndex` keeps two genuine identical bookings on the same day.

## R11 — Categorization

- **Decision**: Ordered rule list (counterparty contains / purpose contains / IBAN equals / amount sign) evaluated on import; first match wins; manual category overrides and is never overwritten by rules. Own-account transfers are auto-detected by matching IBANs of own accounts → type `transfer`.

## R12 — Auth and secrets

- **Decision**: NestJS `AuthModule` with `@fastify/secure-session` (sealed, `httpOnly`, `sameSite=lax`, `secure` in prod); single owner. The password hash is created via `pnpm --filter api owner:set-password` (scrypt) and stored in DB. A global `SessionGuard` protects all routes except `POST /api/auth/login` (`@Public()` decorator), with login rate limiting via `@nestjs/throttler`. A Nuxt global route middleware redirects to `/login` on 401. `API_SESSION_SECRET` (≥ 32 bytes) and `API_ENCRYPTION_KEY` come from `apps/api/.env`.
- **Rationale**: FR-060/FR-061 with minimal surface.

## R13 — Charts' data volume

- **Decision**: Precompute `net_worth_snapshot` daily rows on import/sync (incremental from the earliest changed date). Endpoints downsample to ≤ 400 points per series (weekly for 3J+/All-time).
- **Rationale**: Meets SC-002 without client-side heavy lifting.

## R14 — Tooling

- **Decision**: pnpm, `@nuxt/eslint` flat config, Prettier, `vue-tsc` (web) and `tsc` (api), Vitest in all workspaces (api with `unplugin-swc` for decorators instead of Nest's default Jest), Playwright, Changesets not used (private app, no packages published).
- **Rationale**: Nuxt ecosystem defaults; the repo has no existing conventions yet.

## R15 — Branding

- **Decision**: Own product name (working title "Vermögenskompass"), own logo mark, own primary color (Nuxt UI `primary: 'indigo'` → final brand color set in `app.config.ts`). No reference logos, names, illustrations, or upsell/PLUS banners.
- **Rationale**: FR-005; the reference tool is a third-party trademark.

## R16 — Validation and contract sharing

- **Decision**: Use zod schemas in `packages/shared` as the single source of truth. The API uses them via `nestjs-zod` (`createZodDto`, global `ZodValidationPipe`, Swagger via `@nestjs/swagger` with nestjs-zod's patch). The web imports the same types for typed `$fetch` calls.
- **Rationale**: One schema for request validation, OpenAPI and the frontend types prevents drift without a codegen step.
- **Alternatives considered**: `class-validator` DTOs — Nest default, but cannot be shared with the Vue side without duplication. OpenAPI codegen for the client — adds a generation step.

## R17 — Background work in the API

- **Decision**: CSV import and Scalable sync run in-process as async jobs (`import_job` row and status polling). An optional daily sync uses `@nestjs/schedule`. There is no queue system.
- **Rationale**: Single user, low volume; BullMQ/Redis would only add operations work.

## R18 — Containerization and deployment

- **Decision**: Build separate web and API images with multi-stage Dockerfiles on `node:26-bookworm-slim`. GitHub Actions publishes `latest`, commit SHA, and version tags to the current repository's namespace in GHCR with `packages: write`. `compose.local.yaml` builds the same Dockerfiles for pre-release testing. `deploy/compose.yaml` pulls the published images and defaults to this fork's namespace.
- **Rationale**: The same image definitions support local tests and registry delivery without requiring source checkout on the deployment host. The glibc base avoids `better-sqlite3` musl rebuild issues.
- **Network**: A standard Compose bridge with egress serves both processes. Only the web process publishes to a host port, on loopback by default.
- **Data**: Use `./data/api:/data`. The backup script makes an online SQLite copy, retains seven days, and is tested with a restore to a disposable database. Document, but do not install, daily scheduling.
- **GHCR visibility**: Document both public pulls and authenticated pulls with a read-only token. Do not change live package visibility as part of preparing the workflow.
- **Alternatives considered**: One image for both processes complicates process management; building on the target host requires source and toolchains; an external macvlan makes the template host-specific.
