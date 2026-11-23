import { randomUUIDv7 } from 'node:crypto';
import { dashboardWidgetKeys } from '@finance/shared';
import { sql } from 'drizzle-orm';
import {
  type AnySQLiteColumn,
  blob,
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/** Define a client-generated TEXT UUIDv7 primary key. */
function id() {
  return text('id').primaryKey().$defaultFn(randomUUIDv7);
}

export const owner = sqliteTable(
  'owner',
  {
    id: id(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    inflationRate: text('inflation_rate').notNull().default('0.0253'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('owner_singleton').on(sql`(1)`),
    check('owner_name_length', sql`length(${t.displayName}) BETWEEN 1 AND 60`),
    check('owner_inflation_range', sql`CAST(${t.inflationRate} AS REAL) BETWEEN 0 AND 0.5`),
  ],
);

export const institution = sqliteTable(
  'institution',
  {
    id: id(),
    name: text('name').notNull().unique(),
    bic: text('bic'),
    logoKey: text('logo_key'),
  },
  (t) => [check('institution_bic_length', sql`length(${t.bic}) IN (8, 11)`)],
);

export const dataSource = sqliteTable('data_source', {
  id: id(),
  kind: text('kind', { enum: ['csv', 'scalable_mcp', 'sparkasse_fints'] }).notNull(),
  status: text('status', { enum: ['active', 'needs_reauth', 'error', 'planned', 'disabled'] }).notNull(),
  displayName: text('display_name').notNull(),
  encryptedCredentials: blob('encrypted_credentials', { mode: 'buffer' }),
  toolManifest: text('tool_manifest', { mode: 'json' }),
  lastSyncAt: text('last_sync_at'),
  lastError: text('last_error'),
});

export const account = sqliteTable(
  'account',
  {
    id: id(),
    institutionId: text('institution_id')
      .notNull()
      .references(() => institution.id),
    name: text('name').notNull(),
    type: text('type', { enum: ['depot', 'checking', 'savings', 'reference', 'credit_card', 'cash'] }).notNull(),
    iban: text('iban').unique(),
    parentAccountId: text('parent_account_id').references((): AnySQLiteColumn => account.id, { onDelete: 'set null' }),
    sourceId: text('source_id').references(() => dataSource.id, { onDelete: 'set null' }),
    balanceCents: integer('balance_cents').notNull().default(0),
    isHidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    lastSyncedAt: text('last_synced_at'),
  },
  (t) => [check('account_name_length', sql`length(${t.name}) BETWEEN 1 AND 80`)],
);

export const instrument = sqliteTable(
  'instrument',
  {
    id: id(),
    isin: text('isin').notNull().unique(),
    wkn: text('wkn'),
    name: text('name').notNull(),
    assetClass: text('asset_class', {
      enum: ['stock', 'etf', 'fund', 'bond', 'crypto', 'commodity', 'other'],
    }).notNull(),
    currency: text('currency').notNull(),
  },
  (t) => [
    check('instrument_isin_length', sql`length(${t.isin}) = 12`),
    check('instrument_wkn_length', sql`length(${t.wkn}) = 6`),
    check('instrument_currency_shape', sql`${t.currency} GLOB '[A-Z][A-Z][A-Z]'`),
  ],
);

export const price = sqliteTable(
  'price',
  {
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instrument.id),
    date: text('date').notNull(),
    close: text('close').notNull(),
    source: text('source', { enum: ['scalable', 'csv', 'manual'] }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.instrumentId, t.date] }),
    check('price_positive', sql`CAST(${t.close} AS REAL) > 0`),
  ],
);

export const category = sqliteTable(
  'category',
  {
    id: id(),
    parentId: text('parent_id').references((): AnySQLiteColumn => category.id),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['income', 'expense', 'savings', 'transfer'] }).notNull(),
    color: text('color').notNull(),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    uniqueIndex('category_sibling_name').on(t.parentId, t.name),
    uniqueIndex('category_root_name')
      .on(t.name)
      .where(sql`${t.parentId} IS NULL`),
  ],
);

export const transaction = sqliteTable(
  'transaction',
  {
    id: id(),
    accountId: text('account_id')
      .notNull()
      .references(() => account.id),
    bookingDate: text('booking_date').notNull(),
    valueDate: text('value_date'),
    amountCents: integer('amount_cents').notNull(),
    type: text('type', {
      enum: [
        'income',
        'expense',
        'transfer',
        'buy',
        'sell',
        'dividend',
        'interest',
        'tax',
        'fee',
        'split',
        'deposit',
        'withdrawal',
      ],
    }).notNull(),
    counterparty: text('counterparty'),
    counterpartyIban: text('counterparty_iban'),
    purpose: text('purpose'),
    instrumentId: text('instrument_id').references(() => instrument.id),
    quantity: text('quantity'),
    unitPrice: text('unit_price'),
    feeCents: integer('fee_cents').notNull().default(0),
    taxCents: integer('tax_cents').notNull().default(0),
    categoryId: text('category_id').references(() => category.id, { onDelete: 'set null' }),
    categorySource: text('category_source', { enum: ['manual', 'rule', 'import'] }),
    reviewStatus: text('review_status', { enum: ['unreviewed', 'reviewed'] })
      .notNull()
      .default('unreviewed'),
    source: text('source', { enum: ['csv', 'scalable_mcp', 'manual'] }).notNull(),
    sourceRef: text('source_ref'),
    fingerprint: text('fingerprint').notNull().unique(),
  },
  (t) => [
    index('transaction_account_booking').on(t.accountId, t.bookingDate),
    uniqueIndex('transaction_source_ref').on(t.source, t.sourceRef),
    check(
      'transaction_instrument_required',
      sql`${t.type} NOT IN ('buy', 'sell', 'dividend', 'split') OR ${t.instrumentId} IS NOT NULL`,
    ),
    check(
      'transaction_trade_values_required',
      sql`${t.type} NOT IN ('buy', 'sell') OR (COALESCE(CAST(${t.quantity} AS REAL), 0) > 0 AND COALESCE(CAST(${t.unitPrice} AS REAL), 0) > 0)`,
    ),
    check(
      'transaction_split_ratio_required',
      sql`${t.type} <> 'split' OR COALESCE(CAST(${t.quantity} AS REAL), 0) > 0`,
    ),
  ],
);

export const netWorthSnapshot = sqliteTable(
  'net_worth_snapshot',
  {
    accountId: text('account_id')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    valueCents: integer('value_cents').notNull(),
    investedCents: integer('invested_cents').notNull(),
    externalFlowCents: integer('external_flow_cents').notNull(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.date] })],
);

export const positionLot = sqliteTable(
  'position_lot',
  {
    id: id(),
    accountId: text('account_id')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instrument.id),
    openDate: text('open_date').notNull(),
    quantityOpen: text('quantity_open').notNull(),
    costPerUnit: text('cost_per_unit').notNull(),
    closed: integer('closed', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [check('position_lot_quantity_nonnegative', sql`CAST(${t.quantityOpen} AS REAL) >= 0`)],
);

export const dashboardLayout = sqliteTable(
  'dashboard_layout',
  {
    widgetKey: text('widget_key', { enum: dashboardWidgetKeys }).primaryKey(),
    position: integer('position').notNull().unique(),
    visible: integer('visible', { mode: 'boolean' }).notNull(),
  },
  (t) => [
    check('dashboard_position_range', sql`${t.position} BETWEEN 0 AND 7`),
    check('dashboard_visible_boolean', sql`${t.visible} IN (0, 1)`),
  ],
);
