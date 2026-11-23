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
pnpm --filter api build
pnpm --filter api db:migrate
pnpm --filter api db:seed                       # default categories (+ demo dataset with --demo)
# Set the owner password via stdin from a no-echo prompt; see apps/api/README.md.
pnpm dev                                        # api :3001 + web :3000 in parallel → http://localhost:3000
```

## Quality gates

```powershell
pnpm lint
pnpm typecheck
pnpm test          # Vitest in all workspaces: domain, parsers, Nest e2e (Fastify inject), components
pnpm test:e2e      # Playwright: desktop + 360 px
```

Run applicable gates before each task commit. During bootstrap, record unavailable gates and run the full suite once the tooling and smoke tests are in place.

## Local container test (before every deploy)

```powershell
docker compose -f compose.local.yaml up -d --build   # http://localhost:3000
# Run the owner-password CLI with `exec -T` and a password supplied on stdin.
docker compose -f compose.local.yaml down
```

Run V1, V5, V12 and V19 against the containers. Deploy only after this passes.

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
| V7 | US1 | Compare KPIs with `apps/api/test/fixtures/returns-reference.xlsx` | TWROR/IRR within 0.01 pp (SC-007) |
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
| V18 | API | Open `http://localhost:3001/api/docs`; call `GET /api/overview/kpis` without a cookie | Swagger lists all endpoints from [http-api.md](./contracts/http-api.md); request returns 401 |
| V19 | Docker local | `compose.local.yaml` up, import a CSV, `down`, `up` again | Data still present (bind mount `./data-local/api`); both healthchecks `healthy` |
| V20 | Post-release | Inspect the authorized release run and registry | Both fork images exist with the expected release or commit SHA tag |
| V21 | Template | Run `docker compose --env-file deploy/.env.example -f deploy/compose.yaml config --quiet` | Valid; only published images; bind-mounted data; web published only to loopback by default; API port not published |
| V22 | Post-release | In a disposable directory, pull the pinned published images, start without building, log in, create a test record and recreate the containers | Login works and the record persists (SC-008) |

Contracts: [http-api.md](./contracts/http-api.md), [data-source.md](./contracts/data-source.md), [csv-formats.md](./contracts/csv-formats.md). Entities: [data-model.md](./data-model.md).
