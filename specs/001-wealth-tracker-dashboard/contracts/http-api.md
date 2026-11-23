# Contract: HTTP API (NestJS, `/api`)

Served by `apps/api` (NestJS, Fastify adapter, global prefix `api`, port 3001). The browser reaches it only through the Nuxt proxy at `http://localhost:3000/api/**`. Request/response schemas live in `packages/shared` (zod) and are published as OpenAPI at `/api/docs` (dev only). Session: `@fastify/secure-session` cookie, global `SessionGuard`.

- JSON only; money as integer cents (`*_cents`), decimals as strings, dates `YYYY-MM-DD`.
- All routes except `POST /api/auth/login` (`@Public()`) require the owner session (401 otherwise).
- Validation via `nestjs-zod` `ZodValidationPipe`. Errors: `{ statusCode, statusMessage, data?: { issues } }` (400/401/404/409/422/502).
- Common query params: `accounts` (comma-separated account ids; omitted = all visible), `period` (`1W|1M|YTD|1Y|3Y|5Y|ALL`), `from`/`to` (dates; override `period`).

## Health

| Method | Path | Body / Query | Response |
|--------|------|--------------|----------|
| GET | `/api/health` | – (`@Public()`) | `{ status: 'ok', db: 'ok' }` (200) or 503; used by the Docker healthchecks |

## Auth

| Method | Path | Body / Query | Response |
|--------|------|--------------|----------|
| POST | `/api/auth/login` | `{ password }` | 204 + session cookie; 401 |
| POST | `/api/auth/logout` | – | 204 |
| GET | `/api/auth/session` | – | `{ displayName }` |

## Overview

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/overview/net-worth?period&accounts&mode=value\|return` | `{ totalCents, gainCents, gainPct, series: [{ date, valueCents, investedCents, cashCents, returnPct }] }` (≤ 400 points) |
| GET | `/api/overview/allocation?accounts&unit=eur\|pct` | `{ totalCents, slices: [{ key, label, count, valueCents, pct }] }` |
| GET | `/api/overview/kpis?period&accounts` | `{ investedCents, priceGain: {cents,pct}, realized: {grossCents,netCents,pct}, otherGainsCents, dividends: {grossCents,netCents}, interest: {grossCents,netCents}, taxesFeesCents, totalReturnCents, twror, irr, inflation, realReturn }` (rates as decimal strings, null if not computable) |
| GET | `/api/overview/holdings/top-flop?range=1D\|1W\|1M\|1Y&accounts` | `{ top: Holding[], flop: Holding[] }`, `Holding = { instrumentId, name, priceCents, changePct, changeCents }` |
| GET | `/api/accounts/tree?accounts` | `{ groups: [{ type: 'depots'\|'accounts', totalCents, items: [{ id, name, institution, logoKey, valueCents, children? }] }] }` |
| GET | `/api/transactions/unreviewed/count?accounts` | `{ count }` |
| GET/PUT | `/api/dashboard/layout` | `[{ widgetKey, position, visible }]` |

## Investments

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/investments/performance?period&accounts&unit=eur\|pct` | `{ valueCents, gainCents, series: [{ date, valueCents, investedCents }] }` |
| GET | `/api/investments/positions?accounts&assetClass&status=open\|sold` | `[{ instrumentId, name, assetClass, wkn, isin, priceCents, dayChangePct, quantity, valueCents, entryValueCents, avgPrice, gainCents, gainPct, allocationPct, dividendsCents, realizedCents? }]` |
| GET | `/api/investments/positions.csv?…same` | `text/csv; charset=utf-8` (`;` separated, de-DE decimals) |
| GET | `/api/investments/asset-classes?accounts` | `[{ assetClass, valueCents, pct, count }]` |
| GET | `/api/investments/instruments/:id?period` | `{ instrument, position, series, transactions }` |
| GET | `/api/investments/transactions?accounts&type&from&to&page&pageSize` | `{ items: Transaction[], total }` |

## Budget / cash flow

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/cashflow/summary?granularity=month\|quarter\|year&anchor=YYYY-MM-DD&accounts` | `{ period: {from,to,label}, incomeCents, expenseCents, balanceCents, savedCents, savingsRate, bars: [{ label, from, incomeCents, expenseCents, isCurrent }] }` (12 bars ending at anchor) |
| GET | `/api/cashflow/sankey?granularity&anchor&accounts&unit` | `{ nodes: [{ id, label, kind }], links: [{ source, target, valueCents }] }` |
| GET | `/api/cashflow/categories?granularity&anchor&accounts&kind=expense\|income` | `{ totalCents, count, items: [{ categoryId, name, color, count, totalCents, pct, children }] }` |
| GET | `/api/transactions?accounts&categoryId&status&from&to&q&page&pageSize` | `{ items, total }` |
| PATCH | `/api/transactions/:id` | `{ categoryId?, reviewStatus?, type? , createRule?: { matchField, operator, pattern } }` → updated transaction |
| POST | `/api/transactions` | manual transaction (FR-056) → 201 |
| GET/POST | `/api/categories` · PATCH/DELETE `/api/categories/:id` | tree; delete of `is_default` → 409 |
| GET/POST | `/api/rules` · PATCH/DELETE `/api/rules/:id` | rule CRUD; POST `/api/rules/apply` re-runs rules on unreviewed rows → `{ updated }` |
| GET/POST | `/api/budgets` · PATCH/DELETE `/api/budgets/:id` | `[{ id, categoryId, monthlyLimitCents, spentCents, remainingCents }]` |

## Insurance

| Method | Path | Response |
|--------|------|----------|
| GET/POST | `/api/insurance` | `[{ …contract, yearlyCostCents }]` / 201 |
| PATCH/DELETE | `/api/insurance/:id` | updated / 204 |

## Accounts and data sources

| Method | Path | Response |
|--------|------|----------|
| GET/POST | `/api/accounts` · PATCH/DELETE `/api/accounts/:id` | manual accounts; delete with transactions → 409 unless `?force=true` |
| GET | `/api/sources` | `[{ id, kind, status, displayName, lastSyncAt, lastError }]` (never credentials) |
| POST | `/api/import/csv` | `multipart/form-data { file, accountId?, mappingId? }` → `{ jobId, detectedFormat, needsMapping: bool, preview: Row[10], headers }` |
| POST | `/api/import/csv/:jobId/confirm` | `{ accountId, mapping? , saveMappingAs? }` → `ImportJob` |
| GET | `/api/import/jobs/:id` | `ImportJob { status, imported, skipped, failed, errors[] }` |
| GET/POST | `/api/csv-mappings` · DELETE `/api/csv-mappings/:id` | saved mappings |
| POST | `/api/sources/scalable/connect` | → `{ authorizationUrl }` (OAuth start, PKCE verifier kept server-side) |
| GET | `/api/sources/scalable/callback?code&state` | stores encrypted tokens, discovers tools, redirects to `/settings/sources` |
| POST | `/api/sources/:id/sync` | → `ImportJob` (202 while running); 409 if running; 502 on upstream error |
| DELETE | `/api/sources/:id` | revoke local grant, keep data → 204 |
| GET | `/api/settings` · PATCH | `{ displayName, inflationRate }` |
