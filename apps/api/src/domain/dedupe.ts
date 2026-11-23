import { createHash } from 'node:crypto';

/** Stable identity inputs for a normalized account booking. */
export interface FingerprintInput {
  accountId: string;
  bookingDate: string;
  amountCents: number;
  counterparty?: string | null;
  purpose?: string | null;
}

/** Normalize imported identity text without discarding meaningful punctuation. */
function normalize(value?: string | null): string {
  return (value ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

/** Hash a booking and its zero-based occurrence within identical rows of the same batch. */
export function fingerprint(row: FingerprintInput, occurrenceIndex: number): string {
  if (!Number.isSafeInteger(occurrenceIndex) || occurrenceIndex < 0) throw new RangeError('Invalid occurrence index');
  const fields = [
    row.accountId,
    row.bookingDate,
    row.amountCents,
    normalize(row.counterparty),
    normalize(row.purpose),
    occurrenceIndex,
  ];
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

/** Assign repeatable occurrence indexes without collapsing identical genuine bookings in one export. */
export function createFingerprinter() {
  const seen = new Map<string, number>();
  /** Return the identity of the next occurrence in this batch. */
  return (row: FingerprintInput): string => {
    const base = fingerprint(row, 0);
    const index = seen.get(base) ?? 0;
    seen.set(base, index + 1);
    return index === 0 ? base : fingerprint(row, index);
  };
}

/** Prefer a provider-supplied booking identity before the cross-source fallback. */
export function isDuplicate(
  row: { source: string; sourceRef?: string | null; fingerprint: string },
  lookup: { bySourceRef: (source: string, reference: string) => boolean; byFingerprint: (key: string) => boolean },
): boolean {
  return (!!row.sourceRef && lookup.bySourceRef(row.source, row.sourceRef)) || lookup.byFingerprint(row.fingerprint);
}
