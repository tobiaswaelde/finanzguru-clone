import type { NormalizedPrice, TransactionType } from '@finance/shared';
import { financeDecimal, roundCents, sumCents } from './money.js';
import { shiftDays } from './period.js';
import { PositionBook } from './positions.js';

/** One account-ledger event, including optional depot trade data. */
export interface SnapshotEvent {
  date: string;
  type: TransactionType;
  amountCents: number;
  instrumentId?: string;
  quantity?: string;
  unitPrice?: string;
  feeCents?: number;
  taxCents?: number;
}

/** Daily account values in cents; stale reflects missing same-day prices. */
export interface DailySnapshot {
  date: string;
  valueCents: number;
  investedCents: number;
  externalFlowCents: number;
  stale: boolean;
}

/** Rebuild daily account values; price keys are instrument IDs, not external provider references. */
export function buildSnapshots(options: {
  depot: boolean;
  openingCashCents: number;
  from: string;
  to: string;
  events: readonly SnapshotEvent[];
  prices: readonly (Omit<NormalizedPrice, 'isin'> & { instrumentId: string })[];
}): DailySnapshot[] {
  const { depot, openingCashCents, from, to } = options;
  // Stable sort retains the ledger's explicit tie-break order within a day.
  const events = [...options.events].sort((a, b) => a.date.localeCompare(b.date));
  const prices = [...options.prices].sort((a, b) => a.date.localeCompare(b.date));
  const book = new PositionBook();
  const latest = new Map<string, (typeof prices)[number]>();
  const snapshots: DailySnapshot[] = [];
  let cash = openingCashCents;
  let e = 0;
  let p = 0;
  for (let date = from; date <= to; date = shiftDays(date, 1)) {
    let flow = 0;
    let price: (typeof prices)[number] | undefined;
    while ((price = prices[p]) && price.date <= date) {
      latest.set(price.instrumentId, price);
      p++;
    }
    let event: SnapshotEvent | undefined;
    while ((event = events[e]) && event.date <= date) {
      e++;
      const { type, amountCents, instrumentId, quantity } = event;
      if (depot && (type === 'buy' || type === 'sell' || type === 'split')) {
        if (!instrumentId || !quantity) throw new RangeError('Missing position trade information');
        book.apply({ ...event, type, instrumentId, quantity });
        const previousQuote = latest.get(instrumentId);
        if (type === 'split' && previousQuote && previousQuote.date < event.date) {
          latest.set(instrumentId, {
            ...previousQuote,
            close: new financeDecimal(previousQuote.close).div(quantity).toFixed(),
          });
        }
        if (event.date === date && type !== 'split') flow = sumCents([flow, -amountCents]);
      } else if (!depot) {
        cash = sumCents([cash, amountCents]);
        if (event.date === date && ['transfer', 'deposit', 'withdrawal', 'buy', 'sell'].includes(type)) {
          flow = sumCents([flow, amountCents]);
        }
      }
    }
    let value = new financeDecimal(0);
    let invested = new financeDecimal(0);
    let stale = false;
    for (const lot of book.getLots()) {
      if (lot.quantityOpen === '0') continue;
      const quote = latest.get(lot.instrumentId);
      const quantity = new financeDecimal(lot.quantityOpen);
      stale ||= quote?.date !== date;
      value = value.plus(quantity.times(quote?.close ?? lot.costPerUnit));
      invested = invested.plus(quantity.times(lot.costPerUnit));
    }
    snapshots.push({
      date,
      valueCents: depot ? roundCents(value.times(100)) : cash,
      investedCents: depot ? roundCents(invested.times(100)) : cash,
      externalFlowCents: flow,
      stale,
    });
  }
  return snapshots;
}
