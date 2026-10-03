// V7.7.10j — browser-side Core-auth PKCE helpers for the static Console.
// Pure/public-client mechanics only. No client secret, operator token, accepted-state authority,
// or hidden account selector lives here.

export const CORE_AUTH_SESSION_KEY = 'cs.coreAuth.v1';
export const CORE_AUTH_FLOW_KEY = 'cs.coreAuth.flow.v1';
export const CORE_AUTH_CLIENT_ID = 'https://nothinginfinity.github.io/cairnstone-v6-console/oauth-client-metadata.json';
export const CORE_AUTH_REDIRECT_URI = 'https://nothinginfinity.github.io/cairnstone-v6-console/';
export const CORE_AUTH_SCOPE = 'mcp:core';

const text = value => String(value ?? '').trim();

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function runtimeOrigin(runtimeUrl) {
  const parsed = new URL(text(runtimeUrl));
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('Core auth requires HTTPS runtime');
  }
  return parsed.origin;
}

export function coreAuthMcpUrl(runtimeUrl) {
  return `${runtimeOrigin(runtimeUrl)}/mcp/core-auth`;
}

export function oauthEndpoints(runtimeUrl) {
  const origin = runtimeOrigin(runtimeUrl);
  return {
    authorize: `${origin}/oauth/authorize`,
    token: `${origin}/oauth/token`,
    revoke: `${origin}/oauth/revoke`,
    resource: `${origin}/mcp/core-auth`
  };
}

export function isCoreAuthMcpUrl(runtimeUrl) {
  try {
    return new URL(text(runtimeUrl)).pathname.replace(/\/$/, '') === '/mcp/core-auth';
  } catch {
    return false;
  }
}

export function randomPkceVerifier(cryptoImpl = globalThis.crypto) {
  const bytes = new Uint8Array(32);
  cryptoImpl.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function pkceChallengeS256(verifier, cryptoImpl = globalThis.crypto) {
  const input = new TextEncoder().encode(text(verifier));
  if (input.length < 43 || input.length > 128) throw new Error('PKCE verifier must be 43–128 characters');
  const digest = new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', input));
  return base64Url(digest);
}

export async function buildAuthorizeUrl({
  runtimeUrl,
  verifier,
  state,
  clientId = CORE_AUTH_CLIENT_ID,
  redirectUri = CORE_AUTH_REDIRECT_URI,
  scope = CORE_AUTH_SCOPE
}) {
  const endpoints = oauthEndpoints(runtimeUrl);
  const challenge = await pkceChallengeS256(verifier);
  const url = new URL(endpoints.authorize);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', text(state));
  url.searchParams.set('scope', text(scope));
  url.searchParams.set('resource', endpoints.resource);
  return url.toString();
}

export function parseOAuthCallback(locationLike = globalThis.location) {
  const url = new URL(locationLike.href || String(locationLike));
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  if (!code && !error) return null;
  return {
    code,
    state,
    error,
    error_description: errorDescription,
    iss: url.searchParams.get('iss')
  };
}

export function authorizationCodeTokenBody({ code, verifier, runtimeUrl, clientId = CORE_AUTH_CLIENT_ID, redirectUri = CORE_AUTH_REDIRECT_URI }) {
  const endpoints = oauthEndpoints(runtimeUrl);
  const params = new URLSearchParams();
  params.set('grant_type', 'authorization_code');
  params.set('code', text(code));
  params.set('client_id', clientId);
  params.set('redirect_uri', redirectUri);
  params.set('code_verifier', text(verifier));
  params.set('resource', endpoints.resource);
  return params;
}

export function refreshTokenBody({ refreshToken, runtimeUrl, clientId = CORE_AUTH_CLIENT_ID }) {
  const endpoints = oauthEndpoints(runtimeUrl);
  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', text(refreshToken));
  params.set('client_id', clientId);
  params.set('resource', endpoints.resource);
  return params;
}

export function tokenSessionFromResponse(response, { runtimeUrl, nowMs = Date.now(), prior = null } = {}) {
  if (!response?.access_token || !response?.refresh_token) throw new Error('OAuth token response missing access/refresh token');
  const expiresIn = Math.max(1, Number(response.expires_in || 900));
  return {
    schema: 'cairnstone-console-core-auth-session-v1',
    runtime_origin: runtimeOrigin(runtimeUrl),
    mcp_url: coreAuthMcpUrl(runtimeUrl),
    access_token: String(response.access_token),
    refresh_token: String(response.refresh_token),
    token_type: String(response.token_type || 'Bearer'),
    scope: String(response.scope || prior?.scope || CORE_AUTH_SCOPE),
    expires_at_ms: nowMs + (expiresIn * 1000),
    account_id: response.account_id || prior?.account_id || null,
    tenant_id: response.tenant_id || prior?.tenant_id || null,
    principal_id: response.principal_id || prior?.principal_id || null,
    connection_id: response.connection_id || prior?.connection_id || null,
    token_family_id: response.token_family_id || prior?.token_family_id || null
  };
}

export function sessionUsable(session, runtimeUrl, { nowMs = Date.now(), skewMs = 30_000 } = {}) {
  if (!session?.access_token || !session?.refresh_token) return false;
  if (session.runtime_origin !== runtimeOrigin(runtimeUrl)) return false;
  return Number(session.expires_at_ms || 0) > nowMs + skewMs;
}

export function stripOAuthCallbackFromUrl(locationLike = globalThis.location) {
  const url = new URL(locationLike.href || String(locationLike));
  ['code', 'state', 'error', 'error_description', 'iss'].forEach(key => url.searchParams.delete(key));
  return `${url.pathname}${url.search}${url.hash}`;
}
