import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * OAuth for MCP clients that cannot send a custom header (ChatGPT, Claude chat).
 *
 * SYPI is both the protected resource and its own small authorization server.
 * The design goal is ZERO new storage, because every piece of state an OAuth
 * flow needs can be carried in a signed value instead:
 *
 *   client_id     a signed record of the redirect URIs the client registered
 *   consent ticket the authorize request, validated once and signed, so the
 *                 approve step can only act on parameters we already checked
 *   auth code     who approved, for which client/redirect, bound to the PKCE
 *                 challenge, valid five minutes
 *
 * and the access token the client finally receives is an ordinary SYPI personal
 * access token (hashed in `ApiToken`). That means it is listed in Settings and
 * revoked there, exactly like a token you made by hand — no second credential
 * system to keep consistent.
 *
 * Signed with a key derived from ENCRYPTION_SECRET and domain-separated, so a
 * value minted here can never be mistaken for anything lib/crypto.ts produces.
 *
 * Deliberately NOT here: refresh tokens and expiry. A bearer token that can be
 * revoked, with no expiry, is the same trust model as the tokens people already
 * create. Short-lived tokens with rotation is the next hardening step, and needs
 * storage to do properly (a rotated refresh token must be remembered as used).
 */

export class OAuthConfigError extends Error {
  constructor() {
    super("OAuth is not configured on this server (ENCRYPTION_SECRET is unset).");
    this.name = "OAuthConfigError";
  }
}

function key(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new OAuthConfigError();
  return createHmac("sha256", secret).update("sypi.mcp.oauth.v1").digest();
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

type Kind = "client" | "ticket" | "code";

interface Envelope {
  k: Kind;
  /** Expiry, unix seconds. */
  e: number;
  d: Record<string, unknown>;
}

function mac(body: string): string {
  return b64(createHmac("sha256", key()).update(body).digest());
}

export function sign(kind: Kind, data: Record<string, unknown>, ttlSeconds: number): string {
  const body = b64(JSON.stringify({ k: kind, e: Math.floor(Date.now() / 1000) + ttlSeconds, d: data } satisfies Envelope));
  return `${body}.${mac(body)}`;
}

/** The payload if the signature holds, the kind matches and it has not expired. */
export function verify(kind: Kind, value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  const [body, signature, extra] = value.split(".");
  if (!body || !signature || extra !== undefined) return null;

  const expected = Buffer.from(mac(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const env = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Envelope;
    if (env.k !== kind || typeof env.e !== "number" || env.e < Date.now() / 1000) return null;
    return env.d;
  } catch {
    return null;
  }
}

// ─── Redirect validation ─────────────────────────────────────────────────────

/**
 * Hosts allowed to receive an authorization code when the client is NOT one we
 * registered ourselves — ChatGPT's "user-defined client" and Claude's connector
 * use their own client ids. A code is only ever delivered to a redirect URI, so
 * this list is the whole defence against sending one to an attacker.
 */
const TRUSTED_REDIRECT_HOSTS = ["chatgpt.com", "openai.com", "claude.ai", "claude.com"];

function isLoopback(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function parseRedirect(uri: string): URL | null {
  try {
    const url = new URL(uri);
    if (url.hash) return null;
    if (url.protocol === "https:") return url;
    if (url.protocol === "http:" && isLoopback(url.hostname)) return url; // Claude Code, local tools
    return null;
  } catch {
    return null;
  }
}

/** Is this a redirect URI a client may register or use at all? */
export function isAcceptableRedirect(uri: string): boolean {
  return parseRedirect(uri) !== null;
}

function hostTrusted(url: URL): boolean {
  if (isLoopback(url.hostname)) return true;
  return TRUSTED_REDIRECT_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
}

export interface ClientInfo {
  name: string;
  /** True when we registered it (dynamic registration) rather than inferred it. */
  registered: boolean;
}

/**
 * Decide whether `redirectUri` may receive a code for `clientId`.
 *
 *   - A client we registered: the URI must match one it registered, exactly.
 *   - Any other client id: the URI must be on a trusted host. The client id then
 *     carries no authority of its own, which is fine — these are public clients
 *     protected by PKCE, not by a secret.
 */
export function resolveClient(clientId: string, redirectUri: string): ClientInfo | null {
  const url = parseRedirect(redirectUri);
  if (!url) return null;

  const registered = verify("client", clientId);
  if (registered) {
    const uris = registered.u as string[] | undefined;
    if (!Array.isArray(uris) || !uris.includes(redirectUri)) return null;
    // Registration is open, so the NAME is self-declared and worthless as proof of
    // identity — an attacker can call itself "ChatGPT". Only a host we already
    // trust may use a friendly name; anyone else is shown as the host it will
    // actually send you to.
    const name = hostTrusted(url) ? String(registered.n ?? displayName(url.hostname)) : url.host;
    return { name, registered: true };
  }

  if (!hostTrusted(url)) return null;
  return { name: displayName(url.hostname), registered: false };
}

function displayName(host: string): string {
  if (host.endsWith("chatgpt.com") || host.endsWith("openai.com")) return "ChatGPT";
  if (host.endsWith("claude.ai") || host.endsWith("claude.com")) return "Claude";
  if (isLoopback(host)) return "A local app";
  return host;
}

/** Dynamic client registration: mint a client id that carries its redirect URIs. */
export function registerClient(name: string, redirectUris: string[]): string {
  return sign("client", { n: name.slice(0, 80), u: redirectUris }, 365 * 24 * 3600);
}

// ─── PKCE ────────────────────────────────────────────────────────────────────

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function pkceMatches(verifier: string, challenge: string): boolean {
  // RFC 7636: verifier is 43–128 unreserved characters.
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const a = Buffer.from(pkceChallenge(verifier));
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─── Discovery ───────────────────────────────────────────────────────────────

export const SCOPE = "mcp";

export function resourceMetadataUrl(origin: string): string {
  return `${origin}/.well-known/oauth-protected-resource/api/mcp`;
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: [SCOPE],
    resource_name: "SYPI",
  };
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [SCOPE],
  };
}

/** The OAuth `resource` indicator, when sent, must name this server. */
export function resourceIsOurs(resource: string | null | undefined, origin: string): boolean {
  if (!resource) return true;
  return resource === `${origin}/api/mcp` || resource === origin || resource === `${origin}/`;
}
