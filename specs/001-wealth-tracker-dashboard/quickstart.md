# Quickstart & Validation: Personal Wealth Tracker Dashboard

## Prerequisites

- Node.js 26.x (`node -v` → `v26.*`), pnpm ≥ 10 (`corepack enable`)
- Windows: build tools available in case `better-sqlite3` compiles from source (see research R2)
- Optional: a Scalable Capital account for US3; Sparkasse and Scalable CSV exports for US2

## Setup

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env   # API_SESSION_SECRET (≥32 bytes), API_ENCRYPTION_KEY (32-byte base64), PORT=3001
Copy-Item apps/web/.env.example apps/web/.env   # API_BASE_URL=http://localhost:3001
pnpm --filter api... build
pnpm --filter api db:migrate
pnpm --filter api db:seed                       # default categories (+ demo dataset with --demo)
# Set the owner password via stdin from a no-echo prompt; see apps/api/README.md.
pnpm dev                                        # api :3001 + web :3000 in parallel → http://localhost:3000
```

## Quality gates

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test          # Vitest in all workspaces: domain, parsers, Nest e2e (Fastify inject), components
pnpm test:e2e      # Playwright: desktop + 360 px
```

Run applicable gates before each task commit. During bootstrap, record unavailable gates and run the full suite once the tooling and smoke tests are in place.

## Local container test (before every deploy)

```powershell
docker compose -f compose.local.yaml build
docker compose -f compose.local.yaml run --rm -T --no-deps finance-api node dist/scripts/migrate.js
docker compose -f compose.local.yaml run --rm -T --no-deps finance-api node dist/scripts/seed.js --demo
# Run the owner-password CLI with `run --rm -T --no-deps finance-api node dist/scripts/set-password.js`; supply the password on stdin.
docker compose -f compose.local.yaml up --wait --no-build   # http://localhost:3000
docker compose -f compose.local.yaml down
```

Use a disposable Compose project, writable bind mount and synthetic `.env`; set `FINANCE_LOCAL_DATA_DIR`, `FINANCE_LOCAL_API_ENV` and `FINANCE_LOCAL_WEB_PORT` as needed. Run V1, V5, V12 and V19 against the containers. Deploy only after this passes.

## Portable deployment template (no live rollout)

See `deploy/README.md`. Validate the Compose configuration with example settings and no real secrets. After an approved release has published both images, use a disposable directory with its own `.env` and data, pin the published tag, and run the pull-based smoke test. Do not run these checks against an existing installation.

## Validation scenarios

| # | Story | Steps | Expected |
|---|-------|-------|----------|
| V1 | US2 | Log in → Einstellungen › Datenquellen → upload `apps/api/test/fixtures/csv/sparkasse-camt-v8.csv` | Format `sparkasse-camt-v8` detected; job `succeeded`; counts match fixture README |
| V2 | US2 | Upload the same file again | `imported = 0`, `skipped = n` (SC-003) |
| V3 | US2 | Upload `malformed.csv` | Job `partial`; errors list line numbers + reasons ([csv-formats.md](./contracts/csv-formats.md#row-errors)) |
| V4 | US2 | Upload `unknown-layout.csv` | Column mapper appears; mapping saved; re-upload auto-detects it |
| V5 | US1 | `pnpm --filter api db:seed --demo`, open `/` | All 8 widgets filled; Gesamtvermögen = Σ depot values + Σ cash (to the cent) |
| V6 | US1 | Switch 1W…All-time, Vermögen/Rendite, account filter | Chart, totals, KPIs update; no `NaN` |
| V7 | US1 | Compare KPIs with the spreadsheet formulas and synthetic inputs in `apps/api/test/fixtures/returns-reference.md` and `returns-reference.json` | TWROR/IRR within 0.01 pp (SC-007) |
| V8 | US4 | `/investments` → filter ETF, hide a column, Export | Table/totals update; CSV contains the visible columns only |
| V9 | US5 | `/budget` → Monat/Quartal/Jahr, step back | Figures and 12 bars update; Sankey totals = income |
| V10 | US5 | Categorize an unreviewed row with "Regel speichern" | Count drops by ≥ 1; matching rows are auto-categorized on the next import |
| V11 | US5 | Create budget Lebenshaltung 500 € | Overview budget widget shows spent / remaining |
| V12 | US6 | `/insurance` → add Risiko-Lebensversicherung 23,62 € monthly | Listed with yearly cost 283,44 € |
| V13 | US3 | Datenquellen → "Scalable Capital verbinden" → log in on Scalable's page yourself → Synchronisieren | Positions + reference account match Scalable app (SC-004); `tool_manifest` shows only allowlisted read tools used |
| V14 | US3 | Revoke the token at Scalable (or expire it) → Synchronisieren | Status `needs_reauth`, data unchanged |
| V15 | US7 | Datenquellen | Sparkasse (Live-Abfrage) shown as "geplant", not activatable |
| V16 | All | Playwright at 360 px and in dark/light | No horizontal scroll on any tab (SC-006) |
| V17 | Perf | Seed 5 y daily history + 10k tx, load `/` | Fully rendered < 2 s (SC-002) |
| V18 | API | Open `http://localhost:3001/api/docs`; call `GET /api/overview/kpis` without a cookie | Swagger lists every implemented endpoint in [http-api.md](./contracts/http-api.md); request returns 401 |
| V19 | Docker local | `compose.local.yaml` up, import a CSV, `down`, `up` again | Data still present (bind mount `./data-local/api`); both healthchecks `healthy` |
| V20 | Post-release | Inspect the authorized release run and registry | Both fork images exist with the expected release or commit SHA tag |
| V21 | Template | Run `docker compose --env-file deploy/.env.example -f deploy/compose.yaml config --quiet` | Valid; only published images; bind-mounted data; web published only to loopback by default; API port not published |
| V22 | Post-release | In a disposable directory, pull the pinned published images, start without building, log in, create a test record and recreate the containers | Login works and the record persists (SC-008) |

Contracts: [http-api.md](./contracts/http-api.md), [data-source.md](./contracts/data-source.md), [csv-formats.md](./contracts/csv-formats.md). Entities: [data-model.md](./data-model.md).

### Local validation evidence

- V1–V6, V8–V12 and V15–V16: desktop and 360 px Chromium using `FINANCE_DEV=true pnpm test:e2e` with a disposable seeded database. The overview showed 65,072.00 EUR across eight widgets; the budget journey verified a 500.00 EUR limit and 490.00 EUR remaining. The API integration suite also verifies that a saved matching rule applies on CSV import.
- V7: Vitest against the synthetic spreadsheet reference, tolerance 0.01 percentage points.
- V13–V14: deferred by the owner. No broker session, token revocation test, or real read-tool inspection occurred.
- V18: Fastify integration checked all implemented operations against Swagger, unauthenticated KPI 401, and owner-only settings changes. Deferred broker operations are not published in OpenAPI.
- V19, plus V1/V5/V12 in local containers: image build, seeded dashboard, fixture import and insurance creation passed. After `down` and `up --wait --no-build`, both health checks were healthy; the two CSV bookings and the insurance contract persisted. No registry or deployment host was used.
- V21: the rendered image-only template passed `bash deploy/check-compose.sh` for default and overridden settings. Backup restore and retention passed `bash deploy/test-backup.sh`. Locally tagged images passed initialization, login, online backup and recreation with `--no-build --pull never`.
- V20 and V22: pending separately approved publication of both GHCR images. The local template rehearsal did not pull from GHCR and does not count as V22.

### V17 performance evidence

Run `FINANCE_PERF=true pnpm exec playwright test e2e/performance.spec.ts --config e2e/playwright.config.ts --project=desktop`. It starts a production Nuxt build and a disposable seeded API instance. On `srv-ai` with Node 26 and Chromium, navigation to the visible overview chart took 368 ms with five years of snapshots and 10,000 transactions; multipart preview and confirmation of 50,000 additional rows took 5,646 ms (50,000 imported, no row failures). These are synthetic local measurements, not production guarantees.
