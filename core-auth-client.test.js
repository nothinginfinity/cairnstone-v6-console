import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CORE_AUTH_CLIENT_ID,
  CORE_AUTH_REDIRECT_URI,
  authorizationCodeTokenBody,
  buildAuthorizeUrl,
  coreAuthMcpUrl,
  isCoreAuthMcpUrl,
  oauthEndpoints,
  parseOAuthCallback,
  pkceChallengeS256,
  refreshTokenBody,
  sessionUsable,
  stripOAuthCallbackFromUrl,
  tokenSessionFromResponse
} from './core-auth-client.js';

const RUNTIME = 'https://cairnstone-v6.jaredtechfit.workers.dev/mcp';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

test('PKCE S256 matches RFC 7636 vector', async () => {
  assert.equal(await pkceChallengeS256(VERIFIER), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('Core-auth runtime and OAuth endpoints are derived from the configured origin', () => {
  assert.equal(coreAuthMcpUrl(RUNTIME), 'https://cairnstone-v6.jaredtechfit.workers.dev/mcp/core-auth');
  assert.equal(isCoreAuthMcpUrl(RUNTIME), false);
  assert.equal(isCoreAuthMcpUrl(coreAuthMcpUrl(RUNTIME)), true);
  assert.deepEqual(oauthEndpoints(RUNTIME), {
    authorize: 'https://cairnstone-v6.jaredtechfit.workers.dev/oauth/authorize',
    token: 'https://cairnstone-v6.jaredtechfit.workers.dev/oauth/token',
    revoke: 'https://cairnstone-v6.jaredtechfit.workers.dev/oauth/revoke',
    resource: 'https://cairnstone-v6.jaredtechfit.workers.dev/mcp/core-auth'
  });
});

test('authorize URL is public-client PKCE + exact Core resource', async () => {
  const url = new URL(await buildAuthorizeUrl({ runtimeUrl: RUNTIME, verifier: VERIFIER, state: 'state-123' }));
  assert.equal(url.pathname, '/oauth/authorize');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('client_id'), CORE_AUTH_CLIENT_ID);
  assert.equal(url.searchParams.get('redirect_uri'), CORE_AUTH_REDIRECT_URI);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  assert.equal(url.searchParams.get('scope'), 'mcp:core');
  assert.equal(url.searchParams.get('resource'), coreAuthMcpUrl(RUNTIME));
});

test('token bodies preserve PKCE/resource and refresh rotation inputs', () => {
  const code = authorizationCodeTokenBody({ code: 'code-1', verifier: VERIFIER, runtimeUrl: RUNTIME });
  assert.equal(code.get('grant_type'), 'authorization_code');
  assert.equal(code.get('code'), 'code-1');
  assert.equal(code.get('code_verifier'), VERIFIER);
  assert.equal(code.get('client_id'), CORE_AUTH_CLIENT_ID);
  assert.equal(code.get('redirect_uri'), CORE_AUTH_REDIRECT_URI);
  assert.equal(code.get('resource'), coreAuthMcpUrl(RUNTIME));

  const refresh = refreshTokenBody({ refreshToken: 'csrt_demo', runtimeUrl: RUNTIME });
  assert.equal(refresh.get('grant_type'), 'refresh_token');
  assert.equal(refresh.get('refresh_token'), 'csrt_demo');
  assert.equal(refresh.get('client_id'), CORE_AUTH_CLIENT_ID);
  assert.equal(refresh.get('resource'), coreAuthMcpUrl(RUNTIME));
});

test('callback parsing and cleanup preserve unrelated query/hash state', () => {
  const href = 'https://nothinginfinity.github.io/cairnstone-v6-console/?foo=1&code=abc&state=s1&iss=https%3A%2F%2Fissuer.example#x';
  assert.deepEqual(parseOAuthCallback({ href }), {
    code: 'abc',
    state: 's1',
    error: null,
    error_description: null,
    iss: 'https://issuer.example'
  });
  assert.equal(stripOAuthCallbackFromUrl({ href }), '/cairnstone-v6-console/?foo=1#x');
});

test('token session keeps connection hints but secrets remain caller-owned browser session state', () => {
  const session = tokenSessionFromResponse({
    access_token: 'csat_demo',
    refresh_token: 'csrt_demo',
    token_type: 'Bearer',
    expires_in: 900,
    scope: 'mcp:core',
    account_id: 'acct_demo',
    tenant_id: 'ten_demo',
    principal_id: 'prin_demo',
    connection_id: 'conn_demo'
  }, { runtimeUrl: RUNTIME, nowMs: 1_000_000 });
  assert.equal(session.mcp_url, coreAuthMcpUrl(RUNTIME));
  assert.equal(session.connection_id, 'conn_demo');
  assert.equal(sessionUsable(session, RUNTIME, { nowMs: 1_100_000 }), true);
  assert.equal(sessionUsable(session, 'https://other.example/mcp', { nowMs: 1_100_000 }), false);
});
