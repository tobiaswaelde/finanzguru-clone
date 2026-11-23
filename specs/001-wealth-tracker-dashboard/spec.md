# Feature Specification: Personal Wealth Tracker Dashboard

**Feature Branch**: `1-personal-wealth-tracker-dashboard-overview-investments-budget-insurance`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Rebuild the tool shown in the integrated browser (a personal wealth-tracking web app with the tabs Overview, Investments, Budget, Insurance). Use Nuxt UI, TypeScript, Node 26. Data sources: CSV import and the Scalable Capital MCP server; Sparkasse via bank query later."

## Overview

A self-hosted, single-user personal finance cockpit that consolidates brokerage and bank data into one place. It mirrors the functional scope of the reference tool (net-worth overview, investment positions, cash-flow budget analysis, insurance contracts) under its own name and visual identity. The UI language is German (de-DE, EUR, `1.856,45 €` number format).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See total net worth at a glance (Priority: P1)

As the owner, I open the app and immediately see my total net worth, profit for the selected period, a net-worth history chart, asset allocation, key performance figures, top/flop holdings, my portfolios and accounts, the current month's income vs. expenses, and my budgets.

**Why this priority**: The overview is the entry point and the core value; every other tab drills down from it.

**Independent Test**: Import one broker CSV and one bank CSV, open the overview, and verify every widget shows figures consistent with the imported data.

**Acceptance Scenarios**:

1. **Given** imported holdings and account balances, **When** I open "Übersicht", **Then** I see "Gesamtvermögen" equal to the sum of all depot values plus all cash balances, and "Gewinn" for the selected period.
2. **Given** the net-worth chart, **When** I switch the period (1W, 1M, YTD, 1J, 3J, 5J, All-time), **Then** the chart, total and profit update to that period.
3. **Given** the net-worth chart, **When** I switch between "Vermögen" and "Rendite", **Then** the chart shows absolute values or percentage return respectively.
4. **Given** the chart, **When** I hover a date, **Then** a tooltip shows net worth incl. cash & dividends, invested capital and cash for that date.
5. **Given** the "Aufteilung" widget, **When** I toggle € / %, **Then** the donut and legend show allocation per asset class (e.g. ETF, stock, cash) in that unit.
6. **Given** the "Kennzahlen" widget, **When** I pick a period, **Then** I see invested capital, price gain (€ and %), realized gains (gross/net), other gains, dividends, interest, taxes & fees, total return, TWROR, IRR (IZF), inflation and real return.
7. **Given** the "Holdings" widget, **When** I pick a period (e.g. 1 Tag), **Then** I see the top and flop positions by percentage change.
8. **Given** the "Portfolios & Konten" widget, **Then** depots and cash accounts are grouped with subtotals and per-account balances, collapsible per group.
9. **Given** uncategorized transactions exist, **Then** the overview shows their count ("Ungeprüfte Transaktionen") with a link to review them.
10. **Given** the account filter ("Alle Konten"), **When** I restrict it to a subset of accounts, **Then** all overview widgets recalculate for that subset.

---

### User Story 2 - Import data from CSV (Priority: P1)

As the owner, I upload transaction/position CSV exports from my broker (Scalable Capital) and my bank (Sparkasse) so the app has real data without any live bank connection.

**Why this priority**: Without data no screen has value; CSV is the one source that works offline and without credentials.

**Independent Test**: Upload a sample Scalable CSV and a sample Sparkasse CSV; verify accounts, transactions and positions appear and re-uploading the same file creates no duplicates.

**Acceptance Scenarios**:

1. **Given** a supported CSV file, **When** I upload it and confirm the detected format and target account, **Then** its transactions are stored and the overview updates.
2. **Given** a CSV that was already imported, **When** I upload it again, **Then** previously imported rows are skipped and I see how many rows were new vs. duplicate.
3. **Given** a CSV with an unrecognized layout, **When** I upload it, **Then** I can map its columns (date, amount, counterparty, purpose, ISIN, quantity, price) manually and save the mapping for reuse.
4. **Given** a malformed row, **When** importing, **Then** that row is reported with its line number and reason, and valid rows are still imported.

---

### User Story 3 - Sync my Scalable Capital depot (Priority: P2)

As the owner, I connect my Scalable Capital account via Scalable's official MCP server so positions, transactions and cash balance refresh without manual exports.

**Why this priority**: Removes the manual export step for the main depot; depends on the data model from Story 1/2.

**Independent Test**: Connect Scalable, trigger "Synchronisieren", verify positions and the reference account match the broker's own view.

**Acceptance Scenarios**:

1. **Given** no connection, **When** I choose "Scalable Capital verbinden", **Then** I complete the login/consent myself in Scalable's own flow and the app stores only the resulting access grant.
2. **Given** a connection, **When** I trigger a sync, **Then** positions, transactions and cash balance of the depot and its reference account are updated, and the last-sync time is shown.
3. **Given** an expired or revoked grant, **When** a sync runs, **Then** I see a clear "Verbindung erneuern" prompt and existing data stays unchanged.
4. **Given** a connected account, **Then** the app never places, modifies or cancels orders; it only reads data.

---

### User Story 4 - Investments tab (Priority: P2)

As the owner, I review all positions with a performance chart, filters, and details per holding.

**Why this priority**: Primary drill-down for the investment portion of net worth.

**Independent Test**: With imported positions, open "Investments" and verify table values and the chart.

**Acceptance Scenarios**:

1. **Given** positions, **When** I open "Investments › Positionen", **Then** I see total investment value, profit, a value-vs-invested-capital chart with € / % toggle and period selector.
2. **Given** the positions table, **Then** each row shows name, type, WKN/ISIN, current price and day change, current value with quantity, entry value with average price, price gain (€ and %), allocation % and dividends.
3. **Given** the table, **When** I filter by asset type (Alle, Aktien, ETF, …) or portfolio, **Then** rows and totals update.
4. **Given** the table, **When** I choose visible columns or "Export", **Then** the table updates or a CSV of the visible rows downloads.
5. **Given** fully sold positions, **Then** they are listed separately under "Verkaufte Investments" with realized gain.
6. **Given** the "Assetklassen" view, **Then** I see value and share per asset class.
7. **Given** a position, **When** I open it, **Then** I see its own price/value history and its transactions.
8. **Given** the "Transaktionen" view, **Then** I see all buy/sell/dividend/fee transactions, filterable by portfolio and type.

---

### User Story 5 - Budget / cash-flow analysis (Priority: P2)

As the owner, I analyze income and expenses by month, quarter or year, by category, and manage budgets.

**Why this priority**: Second major tab; builds on imported bank transactions.

**Independent Test**: With categorized bank transactions, open "Budget › Analyse" and verify totals, bar chart, Sankey and category list.

**Acceptance Scenarios**:

1. **Given** transactions, **When** I open "Budget", **Then** I see the selected period (default current month) with income, expenses, balance, amount saved and savings rate, plus a 12-period income/expense bar chart.
2. **Given** the period switcher, **When** I pick Monat / Quartal / Jahr or step back/forward, **Then** all figures update; "Aktueller Monat" jumps back to the current period.
3. **Given** categorized transactions, **Then** a Sankey diagram shows income flowing into main categories and subcategories, toggleable € / %.
4. **Given** the category list, **When** I switch between Ausgaben and Einnahmen, **Then** I see each main category with transaction count and total, and a donut of shares; selecting a category lists its transactions.
5. **Given** an uncategorized transaction, **When** I assign a category, **Then** it leaves the "Ungeprüfte Transaktionen" count and all figures update; I can optionally save a rule so future matching transactions are categorized automatically.
6. **Given** no budgets, **Then** the budget widget shows an empty state with "Jetzt Budgets erstellen"; **When** I create a monthly budget for a category, **Then** I see spent vs. limit and remaining amount.

---

### User Story 6 - Insurance contracts (Priority: P3)

As the owner, I keep a list of my insurance contracts (e.g. health, term-life) with premium and renewal info.

**Why this priority**: Low data volume, independent of imports.

**Independent Test**: Add a health insurance contract and verify it appears in the list and its premium is linked to matching expense transactions.

**Acceptance Scenarios**:

1. **Given** no contracts, **When** I open "Versicherung", **Then** I see an empty state with "Versicherung hinzufügen".
2. **Given** the add dialog, **When** I enter type, provider, contract number, premium, interval and start date, **Then** the contract appears in the list with its yearly cost.
3. **Given** contracts, **Then** I can edit or delete them.

---

### User Story 7 - Sparkasse bank query (Priority: P3, later)

As the owner, I will later fetch Sparkasse account balance and transactions directly from the bank instead of CSV.

**Why this priority**: Explicitly deferred by the owner; this feature only reserves the data-source slot so it can be added without changing other screens.

**Independent Test**: Not part of this delivery; verified by the presence of the data-source abstraction used by CSV and Scalable.

**Acceptance Scenarios**:

1. **Given** the data-source settings, **Then** Sparkasse is listed as "geplant" and cannot be activated yet.

---

### Edge Cases

- No data at all: every widget shows an empty state with a call to import or connect, never `NaN` or `0,00 €` pretending to be real.
- Period longer than available history: the chart starts at the first data point; period profit is computed from that point.
- Missing price for a holding on a date: last known price is carried forward and marked as stale.
- Negative cash balance (overdraft): shown in red, included in net worth.
- Duplicate transactions across sources (same booking from CSV and from Scalable sync): deduplicated by source reference, else by date + amount + counterparty + purpose.
- Stock splits and corporate actions in imported data: quantities and average prices are adjusted, not double-counted.
- Currency other than EUR in an import: converted to EUR at the booking-date rate when present in the file; otherwise the row is rejected with a reason.
- Scalable MCP server unreachable or rate-limited: sync fails gracefully, shows retry, and leaves stored data unchanged.
- Very large CSV (≥ 50,000 rows): import completes with progress feedback and the UI stays responsive.

## Requirements *(mandatory)*

### Functional Requirements

**Shell & navigation**

- **FR-001**: The app MUST provide four top-level tabs: Übersicht, Investments, Budget, Versicherung, plus a header with search, menu and profile entry.
- **FR-002**: The app MUST provide a global account/portfolio filter ("Alle Konten") that applies to every data view.
- **FR-003**: The app MUST support dark and light themes and be usable from 360 px to desktop width.
- **FR-004**: The app MUST format all amounts in de-DE EUR format and color gains green and losses red.
- **FR-005**: The app MUST use its own name, logo and visual identity and MUST NOT reuse the reference tool's branding.

**Overview**

- **FR-010**: Overview MUST show the widgets: net-worth chart (Vermögen/Rendite), Aufteilung, Kennzahlen, Holdings top/flop, Portfolios & Konten, Ungeprüfte Transaktionen, Einnahmen & Ausgaben, Budgets.
- **FR-011**: Net-worth series MUST be derived daily from positions × prices plus cash balances.
- **FR-012**: Kennzahlen MUST compute time-weighted return (TWROR) and money-weighted return (IRR/IZF) for the selected period.
- **FR-013**: Users MUST be able to reorder and hide overview widgets ("Anpassen"); the layout persists.

**Investments**

- **FR-020**: The app MUST list open positions with the columns in Story 4, scenario 2, with configurable column visibility.
- **FR-021**: The app MUST list sold positions separately with realized gain.
- **FR-022**: The app MUST provide position detail and an investment transaction list.
- **FR-023**: The app MUST export the visible positions table as CSV.

**Budget**

- **FR-030**: The app MUST aggregate income and expenses per month, quarter and year with navigation between periods.
- **FR-031**: The app MUST provide a two-level category tree (main category › subcategory) with a German default set (e.g. Wohnen › Miete, Lebenshaltung › Lebensmittel, Versicherung › Risiko-Lebensversicherung, Sparen und Anlegen › Wertpapieranlage).
- **FR-032**: Transfers between own accounts and investment purchases MUST NOT count as expenses; investment purchases count as "Gespart".
- **FR-033**: The app MUST render a Sankey diagram of income into categories.
- **FR-034**: Users MUST be able to categorize transactions manually and create keyword/counterparty rules for auto-categorization.
- **FR-035**: Users MUST be able to create, edit and delete monthly budgets per category.

**Insurance**

- **FR-040**: Users MUST be able to create, edit and delete insurance contracts with type, provider, contract number, premium, payment interval, start date and optional notes.

**Data sources**

- **FR-050**: The app MUST import CSV files from Scalable Capital (transactions) and Sparkasse (account statement) with automatic format detection.
- **FR-051**: The app MUST allow manual column mapping for unknown CSV formats and save mappings.
- **FR-052**: Imports MUST be idempotent (no duplicates on re-import) and report imported / skipped / failed counts.
- **FR-053**: The app MUST connect to Scalable Capital through Scalable's official MCP server, read-only, with the user completing authentication in Scalable's own flow.
- **FR-054**: The app MUST NOT expose or call any order-placing capability of a data source.
- **FR-055**: Data sources MUST plug in through one common source interface so a Sparkasse bank-query source can be added later without changes to the UI.
- **FR-056**: Users MUST be able to add cash accounts and transactions manually ("Hinzufügen").

**Security & privacy**

- **FR-060**: Access to the app MUST be protected by a single owner login.
- **FR-061**: Connection secrets (e.g. MCP access grants) MUST be stored encrypted at rest and never sent to the browser.
- **FR-062**: All financial data MUST stay on the owner's own host; no third-party analytics or telemetry.

**Operations**

- **FR-070**: The app MUST be runnable locally as containers identical to the server deployment, so it can be tested before a rollout.
- **FR-071**: Each released version MUST be published as container images by the code repository's build pipeline; the server deployment MUST only reference these published images.
- **FR-072**: The portable deployment template MUST keep persistent data in a bind-mounted directory, survive container recreation without data loss, and bind the web UI to loopback by default. The API MUST NOT publish a host port.
- **FR-073**: The deployment kit MUST include a consistent online SQLite backup with seven-day retention and instructions for scheduling it daily. Installing a schedule on a real host is out of scope.

### Key Entities

- **Institution**: A bank or broker (Scalable Capital, Sparkasse, manual).
- **Account**: A depot or cash account at an institution; type (depot, checking, savings, reference), currency, current balance, data source, last sync.
- **Instrument**: A tradable security identified by ISIN/WKN; name, asset class (stock, ETF, fund, bond, crypto, other).
- **Position**: Holding of an instrument in a depot; quantity, average entry price, entry value; derived current value and gains.
- **Price**: Daily closing price of an instrument.
- **Transaction**: A booking on an account; date, amount, counterparty, purpose, type (income, expense, transfer, buy, sell, dividend, interest, tax, fee), optional instrument/quantity/price, category, source reference, review status.
- **Category**: Two-level income/expense category tree.
- **CategorizationRule**: Match criteria (counterparty, keyword, amount sign) → category.
- **Budget**: Monthly limit per category.
- **InsuranceContract**: Type, provider, contract number, premium, interval, start date, notes.
- **DataSource / Connection**: Configured source (CSV, Scalable MCP, Sparkasse planned), status, encrypted grant, last sync.
- **ImportJob**: One CSV upload or sync run with counts and per-row errors.
- **CsvMapping**: Saved column mapping for a CSV layout.
- **DashboardLayout**: Order and visibility of overview widgets.
- **NetWorthSnapshot**: Daily derived net worth, invested capital and cash per account.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After importing one Scalable and one Sparkasse CSV, the overview shows correct net worth (matching the sum of source balances to the cent) within 5 seconds of upload.
- **SC-002**: The overview is fully rendered in under 2 seconds on a typical laptop with 5 years of daily history and 10,000 transactions.
- **SC-003**: Re-importing the same CSV produces 0 new transactions in 100% of cases.
- **SC-004**: A Scalable sync reflects the broker's current positions and cash balance exactly (quantity and value to the cent at the broker's last price).
- **SC-005**: The owner can categorize an uncategorized transaction in at most 2 clicks, and saved rules categorize at least 80% of recurring transactions automatically after one month of data.
- **SC-006**: All four tabs are usable without horizontal scrolling at 360 px width.
- **SC-007**: TWROR and IRR values match a reference spreadsheet calculation within 0.01 percentage points for the test dataset.
- **SC-008**: In a disposable environment, the portable Compose stack starts from published images without building from source; recreating its containers keeps 100% of stored test data.

## Assumptions

- Single owner, self-hosted; no multi-user or sharing features ("Teilen" is out of scope for v1).
- The app is tested locally first. The deployment deliverable is a portable Compose template that pulls images from the fork's GHCR namespace. Host selection, network exposure, TLS configuration, and live rollout are separate work.
- No paid tiers, upsell banners or advertising from the reference tool are reproduced.
- Scalable Capital offers an official remote MCP server (`https://mcp.scalable.capital/mcp`) with read access to depot data; the owner authenticates there themselves.
- Market prices come from the Scalable data source for held instruments; instruments only known from CSV keep the prices contained in the CSV until another price source is added.
- Sparkasse live bank query (e.g. FinTS/PSD2) is deferred to a later feature; until then Sparkasse data comes from CSV export.
- Insurance tab is a manual contract list; no broker/advisor integration or tariff comparison.
- Watchlists, dividend planner, tax exemption orders and classifications from the reference tool's menu are out of scope for v1.
- Inflation rate for "Realrendite" is a configurable annual value (default: latest German CPI rate entered by the owner).
