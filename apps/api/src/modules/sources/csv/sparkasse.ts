import type { SyncBatch } from '@finance/shared';
import { isValidIban } from '@finance/shared';
import { euroToCents, financeDecimal } from '../../../domain/money.js';
import { type CsvDetection, normalizeHeader } from './detector.js';
import { emptyBatch, parseCsvDecimal, parseCsvDate, readRows } from './rows.js';

/** Parse a Sparkasse CAMT-V8 or MT940 export into signed cash transactions. */
export function parseSparkasse(file: Buffer, detection: CsvDetection, accountExternalRef?: string): SyncBatch {
  const batch = emptyBatch();
  const columns = detection.headers.map(normalizeHeader);
  const ids = new Set<string>();
  for (const { line, cells, error } of readRows(file, detection)) {
    /** Return the value of a normalized header in this row. */
    const get = (name: string) => cells[columns.indexOf(name)] || undefined;
    const bookingDate = parseCsvDate(get('buchungstag'), 'DD.MM.YY');
    const rawValueDate = get('valutadatum');
    const valueDate = parseCsvDate(rawValueDate, 'DD.MM.YY');
    const currency = (get('waehrung') ?? '').toUpperCase();
    const amount = parseCsvDecimal(get('betrag'), ',');
    const rate = parseCsvDecimal(get('eur je waehrungseinheit'), ',');
    const converted =
      currency === 'EUR'
        ? amount
        : (parseCsvDecimal(get('betrag in eur'), ',') ??
          (amount !== undefined && rate !== undefined && new financeDecimal(rate).gt(0)
            ? new financeDecimal(amount).times(rate).toFixed()
            : undefined));
    let amountCents: number | undefined;
    try {
      amountCents = converted === undefined ? undefined : euroToCents(converted);
    } catch {
      amountCents = undefined;
    }
    const externalRef = accountExternalRef ?? get('auftragskonto')?.replace(/\s/gu, '').toUpperCase();
    const reason =
      error ??
      (!bookingDate || (rawValueDate && !valueDate) ? 'invalid_date' : undefined) ??
      (amount === undefined ? 'invalid_amount' : undefined) ??
      (currency !== 'EUR' && converted === undefined ? 'unknown_currency_no_rate' : undefined) ??
      (amountCents === undefined ? 'invalid_amount' : undefined) ??
      (!externalRef ? 'missing_account' : undefined);
    if (reason || !bookingDate || amountCents === undefined || !externalRef) {
      batch.rowErrors.push({ line, reason: reason ?? 'invalid_row' });
      continue;
    }
    if (!accountExternalRef && !ids.has(externalRef)) {
      ids.add(externalRef);
      batch.accounts.push({
        externalRef,
        type: 'checking',
        institutionName: 'Sparkasse',
        name: 'Sparkasse Girokonto',
        iban: isValidIban(externalRef) ? externalRef : undefined,
      });
    }
    const counterpartyIban = get('kontonummer/iban')?.replace(/\s/gu, '').toUpperCase();
    batch.transactions.push({
      accountExternalRef: externalRef,
      bookingDate,
      valueDate,
      amountCents,
      type: amountCents < 0 ? 'expense' : 'income',
      counterparty: get('beguenstigter/zahlungspflichtiger'),
      counterpartyIban: counterpartyIban && isValidIban(counterpartyIban) ? counterpartyIban : undefined,
      purpose: get('verwendungszweck') ?? get('buchungstext'),
    });
  }
  return batch;
}
