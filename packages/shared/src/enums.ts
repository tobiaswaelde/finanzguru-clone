export const periods = ['1W', '1M', 'YTD', '1Y', '3Y', '5Y', 'ALL'] as const;
export const accountTypes = ['depot', 'checking', 'savings', 'reference', 'credit_card', 'cash'] as const;
export const assetClasses = ['stock', 'etf', 'fund', 'bond', 'crypto', 'commodity', 'other'] as const;
export const transactionTypes = [
  'income',
  'expense',
  'transfer',
  'buy',
  'sell',
  'dividend',
  'interest',
  'tax',
  'fee',
  'split',
  'deposit',
  'withdrawal',
] as const;
export const transactionSources = ['csv', 'scalable_mcp', 'manual'] as const;
export const categoryKinds = ['income', 'expense', 'savings', 'transfer'] as const;
export const categorySources = ['manual', 'rule', 'import'] as const;
export const reviewStatuses = ['unreviewed', 'reviewed'] as const;
export const sourceKinds = ['csv', 'scalable_mcp', 'sparkasse_fints'] as const;
export const sourceStatuses = ['active', 'needs_reauth', 'error', 'planned', 'disabled'] as const;
