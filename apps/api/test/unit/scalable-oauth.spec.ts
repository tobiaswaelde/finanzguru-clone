import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { afterEach, expect, it, vi } from 'vitest';
import { CryptoService } from '../../src/common/crypto.service.js';
import { ScalableOAuthProvider } from '../../src/modules/sources/scalable-mcp/oauth-provider.js';

afterEach(vi.unstubAllEnvs);

it('executes SDK registration and PKCE against a mocked authorization server', async () => {
  vi.stubEnv('API_ENCRYPTION_KEY', Buffer.alloc(32, 1).toString('base64'));
  const crypto = new CryptoService();
  const provider = new ScalableOAuthProvider(crypto);
  const serverUrl = 'https://mcp.scalable.capital/mcp';
  const issuer = 'https://auth.scalable.capital';
  /** Resolve only the mock server's discovery, registration and token routes. */
  const fetchFn: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.startsWith('/.well-known/oauth-protected-resource')) {
      return Response.json({ resource: serverUrl, authorization_servers: [issuer] });
    }
    if (url.pathname === '/.well-known/oauth-authorization-server') {
      return Response.json({
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        registration_endpoint: `${issuer}/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
      });
    }
    if (url.pathname === '/register') {
      expect(JSON.parse(String(init?.body)).redirect_uris).toEqual([provider.redirectUrl.href]);
      return Response.json({ ...provider.clientMetadata, client_id: 'synthetic-client' });
    }
    if (url.pathname === '/token') {
      const form = new URLSearchParams(String(init?.body));
      expect(form.get('code_verifier')).toBe(provider.codeVerifier());
      expect(form.get('code')).toBe('test-code');
      return Response.json({ access_token: 'test-token', token_type: 'Bearer', refresh_token: 'test-refresh' });
    }
    return new Response(null, { status: 404 });
  };
  expect(await auth(provider, { serverUrl, fetchFn })).toBe('REDIRECT');
  const url = provider.authorizationUrl();
  expect(url?.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url?.searchParams.get('state')).toBe(provider.state());
  expect(provider.consumeState(provider.state())).toBe(true);
  expect(provider.consumeState(provider.state())).toBe(false);
  expect(await auth(provider, { serverUrl, fetchFn, authorizationCode: 'test-code' })).toBe('AUTHORIZED');
  const grant = provider.encryptedGrant();
  expect(grant.includes('test-token')).toBe(false);
  expect(new ScalableOAuthProvider(crypto, grant).tokens()?.access_token).toBe('test-token');
});

it('rejects expired authorization and insecure non-loopback redirect settings', () => {
  vi.stubEnv('API_ENCRYPTION_KEY', Buffer.alloc(32, 1).toString('base64'));
  const crypto = new CryptoService();
  const provider = new ScalableOAuthProvider(crypto, null, undefined, 0);
  expect(provider.consumeState(provider.state(), 600_001)).toBe(false);
  expect(() => new ScalableOAuthProvider(crypto, null, 'http://example.com/api/sources/scalable/callback')).toThrow();
});
