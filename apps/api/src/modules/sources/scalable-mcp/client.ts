import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport, StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { AuthExpiredError, ForbiddenToolError, UpstreamError } from '../errors.js';
import { allowedTools, callReadTool, type ReadToolMap, verifiedScalableTools } from './allowlist.js';
import { isScalableUrl, type ScalableOAuthProvider } from './oauth-provider.js';

export const scalableEndpoint = 'https://mcp.scalable.capital/mcp';
const timeoutMs = 30_000;

/** Limit provider discovery to HTTPS broker hosts, enforce timeouts, and never follow redirects. */
export function createScalableFetch(transport: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (!isScalableUrl(url)) throw new UpstreamError('Untrusted Scalable endpoint');
    const inherited = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const timeout = AbortSignal.timeout(timeoutMs);
    return transport(input, {
      ...init,
      redirect: 'error',
      signal: inherited ? AbortSignal.any([inherited, timeout]) : timeout,
    });
  };
}

/** Return the catalog entries needed for auditing tool access. */
export interface ScalableManifestItem {
  name: string;
  description?: string;
  allowed: boolean;
}

/** A connected read-only MCP session. Never exposes an unrestricted tool client. */
export interface ScalableReadSession {
  manifest: ScalableManifestItem[];
  /** Invoke one previously reviewed tool matching the discovered manifest. */
  read(name: string, args?: Record<string, unknown>): ReturnType<Client['callTool']>;
}

/** Execute one operation using the official Streamable HTTP endpoint and release its transport. */
export async function withScalableClient<T>(
  provider: ScalableOAuthProvider,
  operate: (session: ScalableReadSession) => Promise<T>,
  options: { tools?: ReadToolMap; fetch?: typeof fetch } = {},
): Promise<T> {
  if (!provider.tokens()) throw new AuthExpiredError('Scalable authorization is required');
  // Each SDK transport has its own auth circuit breaker. Also bound refresh token reads across the operation.
  const initial = provider.tokens();
  let tokenRead = initial;
  let refreshed = false;
  const client = new Client({ name: 'vermoegensblick', version: '0.1.0' });
  const guardedFetch = createScalableFetch(options.fetch);
  /** Pass only one OAuth refresh request through to the issuer during this operation. */
  const fetchFn: typeof fetch = (input, init) => {
    const refresh = init?.body instanceof URLSearchParams && init.body.get('grant_type') === 'refresh_token';
    if (refresh && refreshed) throw new AuthExpiredError('Scalable authorization is required');
    if (refresh) refreshed = true;
    return guardedFetch(input, init);
  };
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(scalableEndpoint), {
        authProvider: provider,
        fetch: fetchFn,
      }),
      { timeout: timeoutMs },
    );
    const discovered = [];
    let cursor: string | undefined;
    const visited = new Set<string>();
    do {
      const page = await client.listTools(cursor ? { cursor } : {}, { timeout: timeoutMs });
      discovered.push(...page.tools);
      cursor = page.nextCursor;
      if (cursor && (visited.has(cursor) || visited.size >= 9))
        throw new UpstreamError('Invalid Scalable tool catalog pagination');
      if (cursor) visited.add(cursor);
    } while (cursor);
    const allowed = allowedTools(discovered, options.tools ?? verifiedScalableTools);
    return await operate({
      manifest: discovered.map(({ name, description }) => ({ name, description, allowed: allowed.has(name) })),
      read: (name, args = {}) =>
        callReadTool(allowed, name, args, async (tool, parameters) => {
          tokenRead = provider.tokens();
          const result = await client.callTool({ name: tool, arguments: parameters }, undefined, {
            timeout: timeoutMs,
          });
          if (result.isError) throw new UpstreamError('Scalable read tool failed');
          return result;
        }),
    });
  } catch (error) {
    if (error instanceof ForbiddenToolError || error instanceof AuthExpiredError || error instanceof UpstreamError)
      throw error;
    if (
      error instanceof UnauthorizedError ||
      (error instanceof StreamableHTTPError && error.code === 401) ||
      provider.authorizationUrl() ||
      !provider.tokens() ||
      (refreshed && sameTokens(tokenRead, provider.tokens()))
    ) {
      throw new AuthExpiredError('Scalable authorization is required');
    }
    throw new UpstreamError('Scalable connection failed', { cause: error });
  } finally {
    await client.close().catch(() => undefined);
  }
}

/** Compare access grants without exposing their token material in diagnostics. */
function sameTokens(left: OAuthTokens | undefined, right: OAuthTokens | undefined): boolean {
  return left?.access_token === right?.access_token;
}
