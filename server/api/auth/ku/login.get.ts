import env from '~~/lib/env';
import { Buffer } from 'node:buffer';
import { createHash, randomBytes } from 'node:crypto';

function toBase64Url(input: Uint8Array) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createCodeVerifier() {
  return toBase64Url(randomBytes(64));
}

function createCodeChallenge(codeVerifier: string) {
  const digest = createHash('sha256').update(codeVerifier).digest();
  return toBase64Url(digest);
}

function createState() {
  return toBase64Url(randomBytes(32));
}

function getRedirectUri() {
  if (env.REDIRECT_URI.includes('/api/auth/ku/callback')) {
    return env.REDIRECT_URI;
  }

  return new URL('/api/auth/ku/callback', env.APP_URL).toString();
}

function resolveSafeRedirectPath(value: unknown) {
  const redirect = typeof value === 'string' ? value : '';
  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//') || redirect.includes('://')) {
    return null;
  }

  return redirect;
}

export default defineEventHandler(async (event) => {
  const isSecureCookie = env.APP_URL.startsWith('https://');
  const query = getQuery(event);

  const codeVerifier = createCodeVerifier();
  const state = createState();
  const codeChallenge = createCodeChallenge(codeVerifier);
  const redirectUri = getRedirectUri();
  const requestedRedirect = resolveSafeRedirectPath(query.redirect);

  setCookie(event, 'ku_oauth_state', state, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });

  setCookie(event, 'ku_oauth_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });

  // Keep a compatibility cookie name in case callback or proxy rewrites separators.
  setCookie(event, 'ku-oauth_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });

  if (requestedRedirect) {
    setCookie(event, 'ku_oauth_redirect', requestedRedirect, {
      httpOnly: true,
      secure: isSecureCookie,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10,
    });
  }

  const authorizationUrl = new URL(env.AUTHORIZATION_ENDPOINT);
  authorizationUrl.searchParams.set('client_id', env.CLIENT_ID);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('scope', env.SCOPE);
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('code_challenge', codeChallenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');

  return sendRedirect(event, authorizationUrl.toString());
});
