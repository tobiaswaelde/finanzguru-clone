import { ForbiddenToolError } from '../errors.js';

/** Exact tool names and the corresponding validated-purpose keys. */
export type ReadToolMap = Readonly<Partial<Record<'portfolio' | 'transactions' | 'cash' | 'prices', string>>>;

// Remains empty until the official broker's tool manifest has been reviewed.
export const verifiedScalableTools: ReadToolMap = Object.freeze({});
const forbidden = /order|trade|buy|sell|cancel|transfer|savings.?plan|withdraw/iu;

/** Metadata needed to determine whether a discovered tool can be used. */
export interface DiscoveredTool {
  name: string;
  description?: string;
  title?: string;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
}

/** Return only exact verified tools whose names and descriptions contain no action indicators. */
export function allowedTools(
  discovered: readonly DiscoveredTool[],
  verified: ReadToolMap = verifiedScalableTools,
): ReadonlySet<string> {
  const allow = new Set(Object.values(verified));
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const { name } of discovered) {
    if (seen.has(name)) repeated.add(name);
    seen.add(name);
  }
  return new Set(
    discovered
      .filter(
        (item) =>
          allow.has(item.name) &&
          !repeated.has(item.name) &&
          item.annotations?.readOnlyHint !== false &&
          item.annotations?.destructiveHint !== true &&
          !forbidden.test(`${item.name} ${item.title ?? ''} ${item.description ?? ''}`),
      )
      .map((item) => item.name),
  );
}

/** Check the allowlist before making any transport call. */
export async function callReadTool<T>(
  allowed: ReadonlySet<string>,
  name: string,
  args: Record<string, unknown>,
  call: (name: string, args: Record<string, unknown>) => Promise<T>,
): Promise<T> {
  if (!allowed.has(name)) throw new ForbiddenToolError('Scalable tool is not in the verified read-only manifest');
  return call(name, args);
}
