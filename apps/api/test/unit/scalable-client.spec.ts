import { afterEach, expect, it, vi } from 'vitest';
import { CryptoService } from '../../src/common/crypto.service.js';
import { AuthExpiredError, ForbiddenToolError, UpstreamError } from '../../src/modules/sources/errors.js';
import { createScalableFetch, withScalableClient } from '../../src/modules/sources/scalable-mcp/client.js';
import { ScalableOAuthProvider } from '../../src/modules/sources/scalable-mcp/oauth-provider.js';

afterEach(vi.unstubAllEnvs);

it('discovers tools and sends only a verified read request through Streamable HTTP', async () => {
  vi.stubEnv('API_ENCRYPTION_KEY', Buffer.alloc(32).toString('base64'));
  const provider = new ScalableOAuthProvider(new CryptoService());
  provider.saveTokens({ access_token: 'synthetic-token', token_type: 'Bearer' });
  const calls: string[] = [];
  /** Emulate the JSON-RPC methods of the SDK's streaming HTTP transport. */
  const mock: typeof fetch = async (_url, init) => {
    if (init?.method !== 'POST') return new Response(null, { status: 405 });
    const { id, method, params } = JSON.parse(String(init.body));
    calls.push(method);
    expect(init.redirect).toBe('error');
    if (id === undefined) return new Response(null, { status: 202 });
    let result;
    if (method === 'initialize') {
      result = {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'mock', version: '1' },
      };
    } else if (method === 'tools/list') {
      result = {
        tools: [
          { name: 'demo_portfolio', inputSchema: { type: 'object' } },
          { name: 'demo_order', inputSchema: { type: 'object' } },
        ],
      };
    } else if (method === 'tools/call') {
      expect(params.name).toBe('demo_portfolio');
      result = { content: [{ type: 'text', text: 'demo' }] };
    } else {
      throw new Error('Unexpected synthetic request');
    }
    return Response.json({ jsonrpc: '2.0', id, result });
  };
  await withScalableClient(
    provider,
    async (session) => {
      expect(session.manifest).toMatchObject([
        { name: 'demo_portfolio', allowed: true },
        { name: 'demo_order', allowed: false },
      ]);
      await expect(session.read('demo_order')).rejects.toBeInstanceOf(ForbiddenToolError);
      expect((await session.read('demo_portfolio')).content).toEqual([{ type: 'text', text: 'demo' }]);
    },
    { tools: { portfolio: 'demo_portfolio', cash: 'demo_order' }, fetch: mock },
  );
  expect(calls.filter((method) => method === 'tools/call')).toHaveLength(1);
});

it('rejects non-broker origin and reports missing authentication before fetching', async () => {
  vi.stubEnv('API_ENCRYPTION_KEY', Buffer.alloc(32).toString('base64'));
  const mock = vi.fn<typeof fetch>();
  const provider = new ScalableOAuthProvider(new CryptoService());
  expect(() => createScalableFetch(mock)('https://example.com/oauth')).toThrow(UpstreamError);
  await expect(withScalableClient(provider, vi.fn(), { fetch: mock })).rejects.toBeInstanceOf(AuthExpiredError);
  expect(mock).not.toHaveBeenCalled();
});
