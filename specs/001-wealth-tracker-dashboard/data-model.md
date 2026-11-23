# Data Model: Personal Wealth Tracker Dashboard

Conventions: SQLite via Drizzle. `id` = `TEXT` UUIDv7. Timestamps = ISO-8601 UTC `TEXT`. Dates = `YYYY-MM-DD`. Money = `INTEGER` cents (EUR). Decimals (quantity, price, rate) = `TEXT` parsed with `decimal.js`.

## Entities

### owner
| Field | Type | Rules |
|-------|------|-------|
| id | id | single row |
| display_name | text | 1–60 chars |
| password_hash | text | scrypt |
| inflation_rate | decimal | default `0.0253`, 0–0.5 |
| created_at | ts | |

### institution
| Field | Type | Rules |
|-------|------|-------|
| id | id | |
| name | text | unique, e.g. `Scalable Capital`, `Sparkasse Bodensee`, `Manuell` |
| bic | text? | 8/11 chars |
| logo_key | text? | local asset key |

### account
| Field | Type | Rules |
|-------|------|-------|
| id | id | |
| institution_id | fk → institution | |
| name | text | 1–80 |
| type | enum | `depot`, `checking`, `savings`, `reference`, `credit_card`, `cash` |
| iban | text? | validated IBAN checksum; unique when set |
| parent_account_id | fk → account? | e.g. reference account under depot |
| source_id | fk → data_source? | null = manual |
| balance_cents | int | current cash balance (cash types); depots derive value |
| is_hidden | bool | default false |
| sort_order | int | |
| last_synced_at | ts? | |

### instrument
| Field | Type | Rules |
|-------|------|-------|
| id | id | |
| isin | text | unique, ISIN checksum |
| wkn | text? | 6 chars |
| name | text | |
| asset_class | enum | `stock`, `etf`, `fund`, `bond`, `crypto`, `commodity`, `other` |
| currency | text | ISO 4217 |

### price
| Field | Type | Rules |
|-------|------|-------|
| instrument_id | fk | PK (instrument_id, date) |
| date | date | |
| close | decimal | > 0, EUR |
| source | enum | `scalable`, `csv`, `manual` |

### transaction
| Field | Type | Rules |
|-------|------|-------|
| id | id | |
| account_id | fk → account | |
| booking_date | date | indexed with account_id |
| value_date | date? | |
| amount_cents | int | sign: + inflow, − outflow (from account's view) |
| type | enum | `income`, `expense`, `transfer`, `buy`, `sell`, `dividend`, `interest`, `tax`, `fee`, `split`, `deposit`, `withdrawal` |
| counterparty | text? | |
| counterparty_iban | text? | |
| purpose | text? | |
| instrument_id | fk? | required for buy/sell/dividend/split |
| quantity | decimal? | required for buy/sell; split = ratio |
| unit_price | decimal? | |
| fee_cents | int | default 0 |
| tax_cents | int | default 0 |
| category_id | fk → category? | null = uncategorized |
| category_source | enum? | `manual`, `rule`, `import` |
| review_status | enum | `unreviewed`, `reviewed` (default `unreviewed`) |
| source | enum | `csv`, `scalable_mcp`, `manual` |
| source_ref | text? | unique with `source` |
| fingerprint | text | unique (R10) |
| import_job_id | fk → import_job? | |

Validation: buy/sell need instrument, quantity > 0, unit_price > 0. `transfer` requires the counterparty IBAN to belong to an own account (or is set manually).

### category
| Field | Type | Rules |
|-------|------|-------|
| id | id | |
| parent_id | fk → category? | max depth 2 |
| name | text | unique within parent |
| kind | enum | `income`, `expense`, `savings`, `transfer` |
| color | text | Nuxt UI color token |
| is_default | bool | seeded set, not deletable |

### categorization_rule
| Field | Type | Rules |
|-------|------|-------|
| id | id | |
| priority | int | ascending, unique |
| match_field | enum | `counterparty`, `purpose`, `counterparty_iban` |
| operator | enum | `contains`, `equals`, `starts_with`, `regex` |
| pattern | text | regex must compile |
| amount_sign | enum? | `positive`, `negative` |
| category_id | fk → category | |
| enabled | bool | |

### budget
| Field | Type | Rules |
|-------|------|-------|
| id | id | |
| category_id | fk → category | unique; expense kind only |
| monthly_limit_cents | int | > 0 |
| created_at | ts | |

### insurance_contract
| Field | Type | Rules |
|-------|------|-------|
| id | id | |
| type | enum | `health`, `term_life`, `liability`, `household`, `disability`, `car`, `legal`, `other` |
| provider | text | |
| contract_number | text? | |
| premium_cents | int | > 0 |
| interval | enum | `monthly`, `quarterly`, `semiannual`, `annual` |
| start_date | date | |
| end_date | date? | ≥ start_date |
| notes | text? | ≤ 2000 |
| linked_category_id | fk → category? | to match premium expenses |

Derived: `yearly_cost_cents = premium × {12,4,2,1}`.

### data_source
| Field | Type | Rules |
|-------|------|-------|
| id | id | |
| kind | enum | `csv`, `scalable_mcp`, `sparkasse_fints` |
| status | enum | `active`, `needs_reauth`, `error`, `planned`, `disabled` |
| display_name | text | |
| encrypted_credentials | blob? | AES-256-GCM (iv + tag + ciphertext); never returned by API |
| tool_manifest | json? | discovered MCP tools + allowlist decision |
| last_sync_at | ts? | |
| last_error | text? | |

### import_job
| Field | Type | Rules |
|-------|------|-------|
| id | id | |
| source_id | fk → data_source | |
| kind | enum | `csv_upload`, `sync` |
| file_name | text? | |
| file_sha256 | text? | |
| format | text? | detected layout id |
| status | enum | `running`, `succeeded`, `partial`, `failed` |
| imported / skipped / failed | int | counts |
| errors | json | `[{line, reason}]`, max 500 kept |
| started_at / finished_at | ts | |

`source_account` links a provider-local `external_ref` to a local account. Its primary key is `(source_id, external_ref)`; links are removed if the source or account is removed. A CSV import with an explicit target does not overwrite these source links.

### csv_mapping
| Field | Type | Rules |
|-------|------|-------|
| id | id | |
| name | text | |
| header_signature | text | hash of normalized header row, unique |
| delimiter / encoding / date_format / decimal_separator | text | |
| columns | json | `{date, amount, counterparty, iban, purpose, isin, quantity, price, type?}` → column index |
| default_account_id | fk → account? | |

### dashboard_layout
| Field | Type | Rules |
|-------|------|-------|
| widget_key | text | PK; `networth`, `allocation`, `kpis`, `holdings`, `accounts`, `review`, `cashflow`, `budgets` |
| position | int | |
| visible | bool | |

### net_worth_snapshot (derived, rebuildable)
| Field | Type | Rules |
|-------|------|-------|
| account_id | fk | PK (account_id, date) |
| date | date | |
| value_cents | int | depot market value or cash balance |
| invested_cents | int | depot cost basis; cash = balance |
| external_flow_cents | int | for TWROR |

### position_lot (derived, rebuildable)
| Field | Type | Rules |
|-------|------|-------|
| id | id | |
| account_id, instrument_id | fk | |
| open_date | date | |
| quantity_open | decimal | ≥ 0 |
| cost_per_unit | decimal | incl. fees |
| closed | bool | |

## Relationships

```text
institution 1─* account ─* transaction *─1 category ─* (self, parent)
account *─1 data_source 1─* import_job 1─* transaction
account(depot) 1─* position_lot *─1 instrument 1─* price
category 1─0..1 budget        category 1─* categorization_rule
insurance_contract *─0..1 category
account 1─* net_worth_snapshot
```

## State transitions

- **transaction.review_status**: `unreviewed` → `reviewed` (category set manually or confirmed). A rule match on import sets the category but keeps `unreviewed` until confirmed. The overview count = `unreviewed` with `category_id IS NULL`.
- **data_source.status**: `planned` (Sparkasse) · `disabled` → `active` (connect ok) → `needs_reauth` (401/expired refresh) → `active` (reconnect) · any → `error` (sync failure) → `active` (next successful sync).
- **import_job.status**: `running` → `succeeded` | `partial` (some rows failed) | `failed` (nothing imported; DB transaction rolled back).

## Derived recomputation

On import or sync, recompute `position_lot` and `net_worth_snapshot` for the affected accounts from `min(booking_date)` of the changed rows onward, inside the same DB transaction as the import.
