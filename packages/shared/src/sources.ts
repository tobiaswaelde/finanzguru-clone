import type { accountTypes, assetClasses, sourceKinds, sourceStatuses, transactionTypes } from './enums.js';

/** External source identifier. */
export type SourceKind = (typeof sourceKinds)[number];
/** Current source connection status. */
export type SourceStatus = (typeof sourceStatuses)[number];
/** Canonical transaction kind used by source adapters. */
export type TransactionType = (typeof transactionTypes)[number];

/** A source account identified by a stable, source-local reference. */
export interface NormalizedAccount {
  externalRef: string;
  name: string;
  type: (typeof accountTypes)[number];
  iban?: string;
  institutionName: string;
  balanceCents?: number;
  parentExternalRef?: string;
}

/** Security metadata keyed by ISIN. */
export interface NormalizedInstrument {
  isin: string;
  wkn?: string;
  name: string;
  assetClass: (typeof assetClasses)[number];
  currency: string;
}

/** Cash movement or investment transaction with amounts in euro cents. */
export interface NormalizedTransaction {
  accountExternalRef: string;
  sourceRef?: string;
  bookingDate: string;
  valueDate?: string;
  amountCents: number;
  type: TransactionType;
  counterparty?: string;
  counterpartyIban?: string;
  purpose?: string;
  isin?: string;
  quantity?: string;
  unitPrice?: string;
  feeCents?: number;
  taxCents?: number;
}

/** Instrument closing price in EUR decimal notation. */
export interface NormalizedPrice {
  isin: string;
  date: string;
  close: string;
}

/** Adapter output committed atomically by the import pipeline. */
export interface SyncBatch {
  accounts: NormalizedAccount[];
  instruments: NormalizedInstrument[];
  transactions: NormalizedTransaction[];
  prices: NormalizedPrice[];
  positionsSnapshot?: { accountExternalRef: string; isin: string; quantity: string }[];
  rowErrors: { line?: number; reason: string }[];
}

/** Column indexes and optional decoding settings for a custom CSV format. */
export interface CsvMapping {
  columns: { date: number; amount: number } & Partial<
    Record<'counterparty' | 'iban' | 'purpose' | 'isin' | 'quantity' | 'price' | 'type', number>
  >;
  delimiter?: string;
  encoding?: string;
  dateFormat?: string;
  decimalSeparator?: string;
}
