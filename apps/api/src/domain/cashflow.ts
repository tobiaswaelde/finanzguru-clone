import type { TransactionType } from '@finance/shared';
import { sumCents } from './money.js';
import { type DateRange, type Granularity, calendarRange, shiftMonths } from './period.js';

/** Booking information needed to compute budget totals. */
export interface FlowBooking {
  bookingDate: string;
  amountCents: number;
  type: TransactionType;
  categoryId: string | null;
}
/** Two-level category metadata. */
export interface FlowCategory {
  id: string;
  parentId: string | null;
  name: string;
  color: string;
}

/** Classify signed cash movements, excluding internal transfers and investment proceeds. */
function classify(row: FlowBooking): 'income' | 'expense' | 'saved' | null {
  if (row.type === 'buy') return 'saved';
  if (['transfer', 'sell', 'split', 'deposit', 'withdrawal'].includes(row.type)) return null;
  return row.amountCents > 0 ? 'income' : row.amountCents < 0 ? 'expense' : null;
}

/** Aggregate one inclusive interval in integer euro cents. */
export function totals(rows: readonly FlowBooking[], range: DateRange) {
  const groups = { income: [] as number[], expense: [] as number[], saved: [] as number[] };
  for (const row of rows) {
    if (row.bookingDate < range.from || row.bookingDate > range.to) continue;
    const bucket = classify(row);
    if (bucket) groups[bucket].push(Math.abs(row.amountCents));
  }
  const incomeCents = sumCents(groups.income);
  const expenseCents = sumCents(groups.expense);
  const savedCents = sumCents(groups.saved);
  return {
    incomeCents,
    expenseCents,
    savedCents,
    balanceCents: sumCents([incomeCents, -expenseCents]),
    savingsRate: incomeCents ? savedCents / incomeCents : null,
  };
}

/** Format labels for calendar groups without switching to the host timezone. */
function label(granularity: Granularity, date: string): string {
  if (granularity === 'year') return date.slice(0, 4);
  if (granularity === 'quarter') return `Q${Math.ceil(Number(date.slice(5, 7)) / 3)} ${date.slice(0, 4)}`;
  return new Intl.DateTimeFormat('de-DE', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** Build one summary and the 12 calendar buckets ending at the selected anchor. */
export function summarizeCashflow(
  rows: readonly FlowBooking[],
  granularity: Granularity,
  anchor: string,
  today: string,
) {
  const range = calendarRange(granularity, anchor);
  const current = calendarRange(granularity, today).from;
  const size = granularity === 'month' ? 1 : granularity === 'quarter' ? 3 : 12;
  const bars = Array.from({ length: 12 }, (_, index) => {
    const window = calendarRange(granularity, shiftMonths(range.from, -(11 - index) * size));
    const { incomeCents, expenseCents } = totals(rows, window);
    return {
      label: label(granularity, window.from),
      from: window.from,
      incomeCents,
      expenseCents,
      isCurrent: current === window.from,
    };
  });
  return { period: { ...range, label: label(granularity, range.from) }, ...totals(rows, range), bars };
}

/** Accumulate transaction counts and amounts by main and subcategory. */
export function summarizeCategories(
  rows: readonly FlowBooking[],
  categories: readonly FlowCategory[],
  range: DateRange,
  kind: 'income' | 'expense',
) {
  type Item = {
    categoryId: string | null;
    name: string;
    color: string;
    count: number;
    totalCents: number;
    pct: number | null;
  };
  const byId = new Map(categories.map((category) => [category.id, category]));
  const groups = new Map<string | null, Item & { children: Item[] }>();
  let totalCents = 0;
  let count = 0;
  for (const row of rows) {
    if (row.bookingDate < range.from || row.bookingDate > range.to || classify(row) !== kind) continue;
    const category = row.categoryId ? byId.get(row.categoryId) : undefined;
    const parent = category?.parentId ? byId.get(category.parentId) : undefined;
    const main = parent ?? category;
    const key = main?.id ?? null;
    const group = groups.get(key) ?? {
      categoryId: key,
      name: main?.name ?? 'Ohne Kategorie',
      color: main?.color ?? 'neutral',
      count: 0,
      totalCents: 0,
      pct: null,
      children: [],
    };
    const amount = Math.abs(row.amountCents);
    group.count++;
    group.totalCents = sumCents([group.totalCents, amount]);
    if (parent && category) {
      const item = group.children.find((child) => child.categoryId === category.id) ?? {
        categoryId: category.id,
        name: category.name,
        color: category.color,
        count: 0,
        totalCents: 0,
        pct: null,
      };
      if (item.count === 0) group.children.push(item);
      item.count++;
      item.totalCents = sumCents([item.totalCents, amount]);
    }
    groups.set(key, group);
    totalCents = sumCents([totalCents, amount]);
    count++;
  }
  return {
    totalCents,
    count,
    items: [...groups.values()]
      .sort((a, b) => b.totalCents - a.totalCents)
      .map((item) => ({
        ...item,
        pct: totalCents ? item.totalCents / totalCents : null,
        children: item.children.map((child) => ({ ...child, pct: totalCents ? child.totalCents / totalCents : null })),
      })),
  };
}

/** Build a balanced diagram with an explicit deficit or remaining balance where applicable. */
export function cashflowSankey(rows: readonly FlowBooking[], categories: readonly FlowCategory[], range: DateRange) {
  const expense = summarizeCategories(rows, categories, range, 'expense');
  const { incomeCents, savedCents } = totals(rows, range);
  const nodes: { id: string; label: string; kind: string }[] = [];
  const links: { source: string; target: string; valueCents: number }[] = [];
  if (incomeCents || expense.totalCents || savedCents) nodes.push({ id: 'root', label: 'Einnahmen', kind: 'income' });
  for (const item of expense.items) {
    const id = `main:${item.categoryId ?? 'none'}`;
    nodes.push({ id, label: item.name, kind: 'expense' });
    links.push({ source: 'root', target: id, valueCents: item.totalCents });
    for (const child of item.children) {
      const childId = `sub:${child.categoryId}`;
      nodes.push({ id: childId, label: child.name, kind: 'expense' });
      links.push({ source: id, target: childId, valueCents: child.totalCents });
    }
  }
  if (savedCents) {
    nodes.push({ id: 'saved', label: 'Gespart', kind: 'savings' });
    links.push({ source: 'root', target: 'saved', valueCents: savedCents });
  }
  const remainder = sumCents([incomeCents, -expense.totalCents, -savedCents]);
  if (remainder > 0) {
    nodes.push({ id: 'remaining', label: 'Verbleibend', kind: 'balance' });
    links.push({ source: 'root', target: 'remaining', valueCents: remainder });
  } else if (remainder < 0) {
    nodes.push({ id: 'deficit', label: 'Fehlbetrag', kind: 'balance' });
    links.push({ source: 'deficit', target: 'root', valueCents: -remainder });
  }
  return { nodes, links };
}
