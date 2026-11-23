import Decimal from 'decimal.js';

export const financeDecimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

/** Round a decimal amount of cents using half-even and reject unsafe results. */
export function roundCents(cents: Decimal.Value): number {
  const result = new financeDecimal(cents).toDecimalPlaces(0).toNumber();
  if (!Number.isSafeInteger(result)) throw new RangeError('Amount exceeds safe integer cents');
  return result === 0 ? 0 : result;
}

/** Convert euro units to safe integer cents with half-even rounding. */
export function euroToCents(euros: Decimal.Value): number {
  return roundCents(new financeDecimal(euros).times(100));
}

/** Sum integer cents without losing precision to intermediate number arithmetic. */
export function sumCents(values: Iterable<number>): number {
  let total = new financeDecimal(0);
  for (const cents of values) {
    if (!Number.isSafeInteger(cents)) throw new RangeError('Expected safe integer cents');
    total = total.plus(cents);
  }
  return roundCents(total);
}
