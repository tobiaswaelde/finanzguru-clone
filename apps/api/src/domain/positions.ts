import { financeDecimal, roundCents } from './money.js';

/** A transaction that changes the quantity held in a single depot. */
export interface PositionTrade {
  instrumentId: string;
  date: string;
  type: 'buy' | 'sell' | 'split';
  quantity: string;
  unitPrice?: string;
  feeCents?: number;
  taxCents?: number;
}

/** One FIFO lot, with quantities and euro cost per unit as decimal strings. */
export interface PositionLot {
  instrumentId: string;
  openDate: string;
  quantityOpen: string;
  costPerUnit: string;
}

/** Mutable decimal state for FIFO accounting in a single depot. */
export class PositionBook {
  private readonly lots: PositionLot[] = [];
  private realized = new financeDecimal(0);

  /** Apply one trade in booking order; reject oversells rather than inventing basis. */
  apply(trade: PositionTrade): void {
    let quantity = new financeDecimal(trade.quantity);
    if (!quantity.isFinite() || !quantity.gt(0)) throw new RangeError('Invalid position quantity');
    const lots = this.lots.filter((lot) => lot.instrumentId === trade.instrumentId && lot.quantityOpen !== '0');
    if (trade.type === 'split') {
      for (const lot of lots) {
        lot.quantityOpen = new financeDecimal(lot.quantityOpen).times(quantity).toFixed();
        lot.costPerUnit = new financeDecimal(lot.costPerUnit).div(quantity).toFixed();
      }
      return;
    }
    const price = new financeDecimal(trade.unitPrice ?? 0);
    if (!price.isFinite() || !price.gt(0)) throw new RangeError('Invalid trade price');
    const fee = new financeDecimal(trade.feeCents ?? 0).div(100);
    if (trade.type === 'buy') {
      this.lots.push({
        instrumentId: trade.instrumentId,
        openDate: trade.date,
        quantityOpen: quantity.toFixed(),
        costPerUnit: price.plus(fee.div(quantity)).toFixed(),
      });
      return;
    }
    const available = lots.reduce((sum, lot) => sum.plus(lot.quantityOpen), new financeDecimal(0));
    if (available.lt(quantity)) throw new RangeError('Sell exceeds available position quantity');
    let gain = price
      .times(quantity)
      .minus(fee)
      .minus(new financeDecimal(trade.taxCents ?? 0).div(100));
    for (const lot of lots) {
      if (quantity.isZero()) break;
      const open = new financeDecimal(lot.quantityOpen);
      const used = financeDecimal.min(open, quantity);
      gain = gain.minus(used.times(lot.costPerUnit));
      lot.quantityOpen = open.minus(used).toFixed();
      quantity = quantity.minus(used);
    }
    this.realized = this.realized.plus(gain);
  }

  /** Return independent snapshots of both open and closed lots. */
  getLots(): PositionLot[] {
    return this.lots.map((lot) => ({ ...lot }));
  }

  /** Return weighted average cost in EUR per unit, or null for a closed position. */
  averagePrice(instrumentId: string): string | null {
    let quantity = new financeDecimal(0);
    let cost = new financeDecimal(0);
    for (const lot of this.lots) {
      if (lot.instrumentId !== instrumentId) continue;
      quantity = quantity.plus(lot.quantityOpen);
      cost = cost.plus(new financeDecimal(lot.quantityOpen).times(lot.costPerUnit));
    }
    return quantity.isZero() ? null : cost.div(quantity).toFixed();
  }

  /** Return total realized net gain of processed sales, rounded to cents. */
  realizedCents(): number {
    return roundCents(this.realized.times(100));
  }
}
