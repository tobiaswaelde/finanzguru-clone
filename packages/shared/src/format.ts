const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const signedEuro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', signDisplay: 'exceptZero' });
const percentage = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 2 });
const signedPercentage = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});
const date = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });

/** Format an integer number of euro cents using German separators. */
export function formatEur(cents: number, signed = false): string {
  return (signed ? signedEuro : euro).format(cents / 100);
}

/** Format a decimal ratio as a percent; 0.05 represents five percent. */
export function formatPct(ratio: number | string, signed = false): string {
  return (signed ? signedPercentage : percentage).format(Number(ratio));
}

/** Format an ISO date as DD.MM.YYYY without a local timezone conversion. */
export function formatDate(value: string): string {
  return date.format(new Date(`${value}T00:00:00Z`));
}
