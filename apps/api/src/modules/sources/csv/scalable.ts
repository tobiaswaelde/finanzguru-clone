import { isValidIsin, type NormalizedInstrument, type SyncBatch, type TransactionType } from '@finance/shared';
import { euroToCents, financeDecimal } from '../../../domain/money.js';
import { type CsvDetection, normalizeHeader } from './detector.js';
import { emptyBatch, parseCsvDate, parseCsvDecimal, readRows } from './rows.js';

const bookingTypes: Record<string, TransactionType> = {
  buy: 'buy',
  sell: 'sell',
  'savings plan': 'buy',
  distribution: 'dividend',
  interest: 'interest',
  deposit: 'deposit',
  withdrawal: 'withdrawal',
  fee: 'fee',
  taxes: 'tax',
  'corporate action': 'split',
};

/** Parse executed Scalable Capital bookings and their EUR security metadata. */
export function parseScalable(file: Buffer, detection: CsvDetection, accountExternalRef = 'scalable-depot'): SyncBatch {
  const batch = emptyBatch();
  const columns = detection.headers.map(normalizeHeader);
  const instruments = new Map<string, NormalizedInstrument>();
  for (const { line, cells, error } of readRows(file, detection)) {
    /** Read a trimmed export column by name. */
    const get = (name: string) => cells[columns.indexOf(name)] || undefined;
    const bookingType = (get('type') ?? '').toLowerCase();
    const type = Object.hasOwn(bookingTypes, bookingType) ? bookingTypes[bookingType] : undefined;
    const bookingDate = parseCsvDate(get('date'), 'YYYY-MM-DD');
    const isin = get('isin')?.toUpperCase();
    const needsIsin = type === 'buy' || type === 'sell' || type === 'split' || type === 'dividend';
    const needsQuantity = type === 'buy' || type === 'sell' || type === 'split';
    const quantity = parseCsvDecimal(get('shares'), ',');
    const unitPrice = parseCsvDecimal(get('price'), ',');
    const amount = parseCsvDecimal(get('amount'), ',') ?? (type === 'split' && !get('amount') ? '0' : undefined);
    const currency = (get('currency') ?? '').toUpperCase();
    const fx = parseCsvDecimal(get('eur per currency unit'), ',');
    const rate = currency === 'EUR' ? new financeDecimal(1) : fx === undefined ? undefined : new financeDecimal(fx);
    const reference = get('reference');
    const fee = parseCsvDecimal(get('fee') ?? '0', ',');
    const tax = parseCsvDecimal(get('tax') ?? '0', ',');
    const reason =
      error ??
      (get('status')?.toLowerCase() !== 'executed' ? 'not_executed' : undefined) ??
      (!bookingDate ? 'invalid_date' : undefined) ??
      (!type ? 'unknown_transaction_type' : undefined) ??
      (needsIsin && !isin ? 'missing_isin' : undefined) ??
      (isin && !isValidIsin(isin) ? 'invalid_isin' : undefined) ??
      (needsQuantity && (!quantity || !new financeDecimal(quantity).gt(0)) ? 'missing_quantity' : undefined) ??
      (!rate?.gt(0) ? 'unknown_currency_no_rate' : undefined) ??
      (amount === undefined || fee === undefined || tax === undefined ? 'invalid_amount' : undefined) ??
      ((type === 'buy' || type === 'sell') && (!unitPrice || !new financeDecimal(unitPrice).gt(0))
        ? 'missing_price'
        : undefined);
    if (reason || !bookingDate || !type || !rate || amount === undefined || fee === undefined || tax === undefined) {
      batch.rowErrors.push({ line, reason: reason ?? 'invalid_row' });
      continue;
    }
    try {
      const convertedPrice = unitPrice === undefined ? undefined : new financeDecimal(unitPrice).times(rate).toFixed();
      const normalized = {
        accountExternalRef,
        sourceRef: reference,
        bookingDate,
        amountCents: euroToCents(rate.times(amount)),
        type,
        isin,
        quantity,
        unitPrice: convertedPrice,
        feeCents: Math.abs(euroToCents(rate.times(fee))),
        taxCents: Math.abs(euroToCents(rate.times(tax))),
        purpose: get('description'),
      };
      if (isin && !instruments.has(isin)) {
        const asset = (get('assettype') ?? '').toLowerCase();
        const assetClass = asset === 'etf' ? 'etf' : asset === 'stock' || asset === 'share' ? 'stock' : 'other';
        instruments.set(isin, { isin, name: get('description') ?? isin, currency: 'EUR', assetClass });
      }
      batch.transactions.push(normalized);
      if (isin && convertedPrice && new financeDecimal(convertedPrice).gt(0)) {
        batch.prices.push({ isin, date: bookingDate, close: convertedPrice });
      }
    } catch {
      batch.rowErrors.push({ line, reason: 'invalid_amount' });
    }
  }
  batch.instruments = [...instruments.values()];
  return batch;
}
