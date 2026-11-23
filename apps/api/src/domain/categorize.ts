import type { TransactionType, ruleInputSchema } from '@finance/shared';
import { RE2 } from 're2-wasm';

/** Validated rule with the runtime enable state. */
export type CategorizationRule = ReturnType<typeof ruleInputSchema.parse>;

/** Editable fields involved in rule matching. */
export interface Categorizable {
  type: TransactionType;
  amountCents: number;
  counterparty?: string | null;
  purpose?: string | null;
  counterpartyIban?: string | null;
  categoryId?: string | null;
  categorySource?: 'manual' | 'rule' | 'import' | null;
}

/** Normalize an IBAN before comparing account identifiers. */
function iban(value?: string | null): string {
  return (value ?? '').replace(/\s/gu, '').toUpperCase();
}

/** Compile a supported Unicode regular expression in a linear-time engine. */
export function compileRuleRegex(pattern: string): RE2 {
  return new RE2(pattern, 'iu');
}

/** Prepare a deterministic matcher once per batch, ignoring disabled or legacy invalid rules. */
export function createCategorizer(rules: readonly CategorizationRule[], ownIbans: Iterable<string>) {
  const own = new Set([...ownIbans].map(iban).filter(Boolean));
  const ordered = [...rules].filter((rule) => rule.enabled !== false).sort((a, b) => a.priority - b.priority);
  const matchers = ordered.map((rule) => {
    let regex: RE2 | undefined;
    if (rule.operator === 'regex') {
      try {
        regex = compileRuleRegex(rule.pattern);
      } catch {
        // Ignore legacy unsupported patterns rather than aborting an import.
      }
    }
    return { rule, regex };
  });
  /** Classify a row respecting manual overrides and account-to-account transfers. */
  return (row: Categorizable): Categorizable => {
    if (row.categorySource === 'manual') return row;
    const next = own.has(iban(row.counterpartyIban)) ? { ...row, type: 'transfer' as const } : row;
    for (const { rule, regex } of matchers) {
      if (rule.amountSign === 'positive' && row.amountCents <= 0) continue;
      if (rule.amountSign === 'negative' && row.amountCents >= 0) continue;
      const raw =
        rule.matchField === 'counterparty_iban'
          ? iban(row.counterpartyIban)
          : (next[rule.matchField]?.normalize('NFKC').trim() ?? '');
      const value = raw.toLowerCase();
      const pattern = (
        rule.matchField === 'counterparty_iban' ? iban(rule.pattern) : rule.pattern.normalize('NFKC').trim()
      ).toLowerCase();
      const matched =
        rule.operator === 'regex'
          ? regex?.test(raw)
          : rule.operator === 'equals'
            ? value === pattern
            : rule.operator === 'starts_with'
              ? value.startsWith(pattern)
              : value.includes(pattern);
      if (matched) return { ...next, categoryId: rule.categoryId, categorySource: 'rule' };
    }
    return next;
  };
}
