# Contract: DataSource interface

Location: `apps/api/src/modules/sources/data-source.interface.ts` (types re-exported from `packages/shared`). Implementations are Nest providers registered in `SourcesModule` under an injection token per `SourceKind` and resolved by `SourcesRegistry`. All sources produce normalized records. Persistence, dedupe (R10), categorization (R11) and recomputation are done by the shared import pipeline, never by a source.

```ts
export type SourceKind = 'csv' | 'scalable_mcp' | 'sparkasse_fints'
export type SourceStatus = 'active' | 'needs_reauth' | 'error' | 'planned' | 'disabled'

export interface NormalizedAccount {
  externalRef: string            // stable id within the source
  name: string
  type: 'depot' | 'checking' | 'savings' | 'reference' | 'credit_card' | 'cash'
  iban?: string
  institutionName: string
  balanceCents?: number          // cash accounts
  parentExternalRef?: string
}

export interface NormalizedInstrument {
  isin: string; wkn?: string; name: string
  assetClass: 'stock' | 'etf' | 'fund' | 'bond' | 'crypto' | 'commodity' | 'other'
  currency: string
}

export interface NormalizedTransaction {
  accountExternalRef: string
  sourceRef?: string             // source-native id → unique (source, source_ref)
  bookingDate: string; valueDate?: string
  amountCents: number            // + inflow / − outflow
  type: TransactionType
  counterparty?: string; counterpartyIban?: string; purpose?: string
  isin?: string; quantity?: string; unitPrice?: string
  feeCents?: number; taxCents?: number
}

export interface NormalizedPrice { isin: string; date: string; close: string }

export interface SyncBatch {
  accounts: NormalizedAccount[]
  instruments: NormalizedInstrument[]
  transactions: NormalizedTransaction[]
  prices: NormalizedPrice[]
  positionsSnapshot?: { accountExternalRef: string; isin: string; quantity: string }[] // for reconciliation
  rowErrors: { line?: number; reason: string }[]
}

export interface DataSource {
  readonly kind: SourceKind
  status(): Promise<SourceStatus>
  /** CSV: parse uploaded file. Pull sources: fetch since cursor. Must be read-only. */
  fetch(input: FetchInput): Promise<SyncBatch>
}

export type FetchInput =
  | { kind: 'csv'; file: Buffer; fileName: string; mapping?: CsvMapping }
  | { kind: 'pull'; since?: string }
```

## Rules

1. A source MUST NOT write to the external system. `scalable_mcp` calls only tools in `apps/api/src/modules/sources/scalable-mcp/allowlist.ts`; any other tool call throws `ForbiddenToolError` before the request is sent (FR-054).
2. Errors: `AuthExpiredError` → status `needs_reauth`; `UpstreamError` → status `error` + 502 at the API. In both cases no partial writes happen (the pipeline wraps each batch in one DB transaction).
3. `positionsSnapshot` (when present) is compared with derived lots after import; a mismatch is logged on the import job as a warning row and does not abort the import.
4. `sparkasse_fints` returns `status() === 'planned'`, and `fetch` throws `NotImplementedError`. The UI shows it as "geplant" (US7).

## Scalable MCP mapping

- Transport: Streamable HTTP to `https://mcp.scalable.capital/mcp`, OAuth bearer from the encrypted token set; refresh on 401 once, then `AuthExpiredError`.
- On connect: `tools/list`. Store the manifest in `data_source.tool_manifest` together with the allowlist decision per tool.
- The mapper converts portfolio, transaction, cash and price tool results into `SyncBatch`. Raw responses from the first real connection are saved (anonymized) as fixtures under `apps/api/test/fixtures/scalable-mcp/` for contract tests.
