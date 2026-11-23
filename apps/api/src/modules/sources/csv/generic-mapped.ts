import {
  type CsvMapping,
  type NormalizedInstrument,
  type SyncBatch,
  type TransactionType,
  isValidIban,
  isValidIsin,
  transactionTypes,
} from '@finance/shared';
import { financeDecimal } from '../../../domain/money.js';
import { type CsvDetection, detectCsv } from './detector.js';
import { emptyBatch, parseCsvCents, parseCsvDate, parseCsvDecimal, readRows } from './rows.js';

/** Parse CSV data with owner-selected columns and date/number conventions. */
export function parseGenericMapped(
  file: Buffer,
  mapping: CsvMapping,
  accountExternalRef: string,
  detected?: CsvDetection,
): SyncBatch {
  const detection = mapping.encoding || mapping.delimiter ? detectCsv(file, mapping) : (detected ?? detectCsv(file));
  const batch = emptyBatch();
  const instruments = new Map<string, NormalizedInstrument>();
  const dateFormat = mapping.dateFormat ?? 'YYYY-MM-DD';
  const decimal = mapping.decimalSeparator ?? (detection.delimiter === ';' ? ',' : '.');
  const columns = mapping.columns;
  for (const { line, cells, error } of readRows(file, detection, mapping.skipRows)) {
    /** Resolve an optional mapped field by index. */
    const get = (field: keyof CsvMapping['columns']) => {
      const index = columns[field];
      return index === undefined ? undefined : cells[index] || undefined;
    };
    const bookingDate = parseCsvDate(get('date'), dateFormat);
    const rawValueDate = get('valueDate');
    const valueDate = parseCsvDate(rawValueDate, dateFormat);
    const amountCents = parseCsvCents(get('amount'), decimal);
    const rawType = get('type');
    const type = transactionTypes.find((item) => item === rawType?.toLowerCase());
    const isin = get('isin')?.toUpperCase();
    const quantity = parseCsvDecimal(get('quantity'), decimal);
    const unitPrice = parseCsvDecimal(get('price'), decimal);
    const feeCents = parseCsvCents(get('fee') ?? '0', decimal);
    const taxCents = parseCsvCents(get('tax') ?? '0', decimal);
    const trade = type === 'buy' || type === 'sell';
    const needsInstrument = trade || type === 'split' || type === 'dividend';
    const reason =
      error ??
      (!bookingDate || (rawValueDate && !valueDate) ? 'invalid_date' : undefined) ??
      (amountCents === undefined || feeCents === undefined || taxCents === undefined ? 'invalid_amount' : undefined) ??
      (rawType && !type ? 'unknown_transaction_type' : undefined) ??
      (needsInstrument && !isin ? 'missing_isin' : undefined) ??
      (isin && !isValidIsin(isin) ? 'invalid_isin' : undefined) ??
      ((trade || type === 'split') && (!quantity || !new financeDecimal(quantity).gt(0))
        ? 'missing_quantity'
        : undefined) ??
      (trade && (!unitPrice || !new financeDecimal(unitPrice).gt(0)) ? 'missing_price' : undefined);
    if (reason || !bookingDate || amountCents === undefined || feeCents === undefined || taxCents === undefined) {
      batch.rowErrors.push({ line, reason: reason ?? 'invalid_row' });
      continue;
    }
    const rawIban = get('iban')?.replace(/\s/gu, '').toUpperCase();
    const transactionType: TransactionType = type ?? (amountCents < 0 ? 'expense' : 'income');
    batch.transactions.push({
      accountExternalRef,
      bookingDate,
      valueDate,
      amountCents,
      type: transactionType,
      counterparty: get('counterparty'),
      counterpartyIban: rawIban && isValidIban(rawIban) ? rawIban : undefined,
      purpose: get('purpose'),
      isin,
      quantity,
      unitPrice,
      feeCents: Math.abs(feeCents),
      taxCents: Math.abs(taxCents),
    });
    if (isin && !instruments.has(isin))
      instruments.set(isin, { isin, name: isin, assetClass: 'other', currency: 'EUR' });
    if (isin && unitPrice && new financeDecimal(unitPrice).gt(0)) {
      batch.prices.push({ isin, date: bookingDate, close: unitPrice });
    }
  }
  batch.instruments = [...instruments.values()];
  return batch;
}
