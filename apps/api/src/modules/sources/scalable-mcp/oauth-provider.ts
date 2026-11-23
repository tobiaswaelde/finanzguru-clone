import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { OAuthClientProvider, OAuthDiscoveryState } from '@modelcontextprotocol/sdk/client/auth.js';
import {
  OAuthClientInformationFullSchema,
  OAuthClientInformationSchema,
  OAuthTokensSchema,
  type OAuthClientInformationMixed,
  type OAuthClientMetadata,
  type OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { z } from 'zod';
import type { CryptoService } from '../../../common/crypto.service.js';

const storedGrantSchema = z.object({
  client: z.union([OAuthClientInformationFullSchema, OAuthClientInformationSchema]).optional(),
  tokens: OAuthTokensSchema.optional(),
});
type StoredGrant = z.infer<typeof storedGrantSchema>;
const defaultCallback = 'http://localhost:3000/api/sources/scalable/callback';

/** Hold a short-lived single-use authorization flow and grant material for exactly one connection. */
export class ScalableOAuthProvider implements OAuthClientProvider {
  readonly redirectUrl: URL;
  private readonly nonce = randomBytes(32).toString('hex');
  private readonly expiresAt: number;
  private consumed = false;
  private verifier?: string;
  private authorizeAt?: URL;
  private discovery?: OAuthDiscoveryState;
  private grant: StoredGrant;

  /** Restore encrypted grant material or begin a fresh flow without persisting PKCE state. */
  constructor(
    private readonly crypto: CryptoService,
    encrypted: Buffer | null = null,
    callback = process.env.SCALABLE_REDIRECT_URI ?? defaultCallback,
    now = Date.now(),
  ) {
    this.redirectUrl = new URL(callback);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(this.redirectUrl.hostname);
    if (
      (this.redirectUrl.protocol !== 'https:' && !(loopback && this.redirectUrl.protocol === 'http:')) ||
      this.redirectUrl.username ||
      this.redirectUrl.password ||
      this.redirectUrl.hash ||
      this.redirectUrl.pathname !== '/api/sources/scalable/callback' ||
      this.redirectUrl.search
    ) {
      throw new Error('Scalable callback must use HTTPS or a loopback HTTP callback');
    }
    this.expiresAt = now + 10 * 60_000;
    this.grant = encrypted === null ? {} : storedGrantSchema.parse(JSON.parse(crypto.decrypt(encrypted)));
  }

  /** Describe a public PKCE authorization-code client for dynamic registration. */
  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'Vermögensblick',
      redirect_uris: [this.redirectUrl.href],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  /** Return the random CSRF nonce sent to the authorization server. */
  state(): string {
    return this.nonce;
  }

  /** Accept the callback state at most once and only within its lifetime. */
  consumeState(value: string, now = Date.now()): boolean {
    if (this.consumed || now >= this.expiresAt || !/^[a-f0-9]{64}$/u.test(value)) return false;
    if (!timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(this.nonce, 'hex'))) return false;
    this.consumed = true;
    return true;
  }

  /** Return the client registration bound to its authorization issuer. */
  clientInformation(): OAuthClientInformationMixed | undefined {
    return this.grant.client;
  }

  /** Remember the dynamically registered client for future exchanges. */
  saveClientInformation(client: OAuthClientInformationMixed): void {
    this.grant.client = client;
  }

  /** Provide saved grants to the SDK, never to HTTP callers. */
  tokens(): OAuthTokens | undefined {
    return this.grant.tokens;
  }

  /** Save refreshed or newly issued tokens; persist them only via encryptedGrant. */
  saveTokens(tokens: OAuthTokens): void {
    const previous = this.grant.tokens;
    this.grant.tokens = {
      ...tokens,
      refresh_token: tokens.refresh_token ?? (previous?.issuer === tokens.issuer ? previous?.refresh_token : undefined),
    };
  }

  /** Capture where the browser should authenticate directly with the provider. */
  redirectToAuthorization(url: URL): void {
    if (!isScalableUrl(url)) throw new Error('Untrusted authorization endpoint');
    this.authorizeAt = new URL(url);
  }

  /** Return the captured authorization URL without exposing verifier or tokens. */
  authorizationUrl(): URL | undefined {
    return this.authorizeAt && new URL(this.authorizeAt);
  }

  /** Keep PKCE material in process memory. */
  saveCodeVerifier(verifier: string): void {
    this.verifier = verifier;
  }

  /** Return PKCE material only to the exchange; fail closed if lost. */
  codeVerifier(): string {
    if (!this.verifier) throw new Error('No pending Scalable authorization');
    return this.verifier;
  }

  /** Cache discovery metadata in process memory for the callback or refresh. */
  saveDiscoveryState(discovery: OAuthDiscoveryState): void {
    this.discovery = discovery;
  }

  /** Read the discovered metadata for this flow. */
  discoveryState(): OAuthDiscoveryState | undefined {
    return this.discovery;
  }

  /** Clear only the credential fields the SDK invalidated. */
  invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): void {
    if (scope === 'all' || scope === 'client') delete this.grant.client;
    if (scope === 'all' || scope === 'tokens') delete this.grant.tokens;
    if (scope === 'all' || scope === 'verifier') this.verifier = undefined;
    if (scope === 'all' || scope === 'discovery') this.discovery = undefined;
  }

  /** Serialize only registered client information and tokens using AES-GCM. */
  encryptedGrant(): Buffer {
    return this.crypto.encrypt(JSON.stringify(this.grant));
  }
}

/** Trust HTTPS on the broker's DNS namespace, not display names or redirects. */
export function isScalableUrl(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    (url.hostname === 'scalable.capital' || url.hostname.endsWith('.scalable.capital'))
  );
}
