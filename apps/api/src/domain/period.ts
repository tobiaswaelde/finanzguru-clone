import type { periods } from '@finance/shared';

/** An inclusive interval of ISO calendar dates. */
export interface DateRange {
  from: string;
  to: string;
}

/** Calendar granularity used by cash-flow views. */
export type Granularity = 'month' | 'quarter' | 'year';
/** Named overview period as represented on the wire. */
export type Period = (typeof periods)[number];

/** Parse an ISO calendar date without accepting overflow or timezone conversion. */
function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || asDate(date) !== value) throw new RangeError('Invalid ISO calendar date');
  return date;
}

/** Encode a UTC date as YYYY-MM-DD. */
function asDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Shift a UTC date by calendar days. */
export function shiftDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return asDate(date);
}

/** Shift a UTC date by months, clamping its day to the target month's last day. */
export function shiftMonths(value: string, months: number): string {
  const date = parseDate(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months + 1, 0);
  date.setUTCDate(Math.min(day, date.getUTCDate()));
  return asDate(date);
}

/** Resolve overview bounds, using explicit bounds in place of the named period. */
export function resolvePeriod(
  query: { period?: Period; from?: string; to?: string },
  today: string,
  firstDate: string,
): DateRange {
  parseDate(today);
  parseDate(firstDate);
  const to = query.to ?? today;
  parseDate(to);
  const period = query.period ?? 'ALL';
  const months = { '1M': 1, '1Y': 12, '3Y': 36, '5Y': 60 } as const;
  let from: string;
  if (query.from || query.to) from = query.from ?? (firstDate < to ? firstDate : to);
  else if (period === 'ALL') from = firstDate < to ? firstDate : to;
  else if (period === 'YTD') from = `${to.slice(0, 4)}-01-01`;
  else if (period === '1W') from = shiftDays(to, -7);
  else from = shiftMonths(to, -months[period]);
  parseDate(from);
  if (from > to) throw new RangeError('Period starts after it ends');
  return { from, to };
}

/** Return inclusive calendar month, quarter, or year bounds containing the anchor date. */
export function calendarRange(granularity: Granularity, anchor: string): DateRange {
  const date = parseDate(anchor);
  const width = granularity === 'month' ? 1 : granularity === 'quarter' ? 3 : 12;
  date.setUTCMonth(Math.floor(date.getUTCMonth() / width) * width, 1);
  const from = asDate(date);
  return { from, to: shiftDays(shiftMonths(from, width), -1) };
}
