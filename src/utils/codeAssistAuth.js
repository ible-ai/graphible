// Sign in with Google against the Code Assist API, the way gemini-cli does.
//
// This is the only Gemini path that spends the *user's* own free allowance
// rather than the site operator's. The Gemini Developer API attributes every
// request to a billable Cloud project, so it can only ever bill whoever
// deployed Graphible or a project the user created themselves. Code Assist
// attributes to the signed-in account instead.
//
// Reaching it means presenting gemini-cli's OAuth client, whose id and secret
// are published in its source: it is a public client, so neither value is a
// credential in the OAuth sense - PKCE is what actually protects the exchange.
// Google's own consent screen names "Gemini CLI", so the sign-in button says
// so too rather than implying the grant goes to Graphible.
//
// Values below are from packages/core/src/code_assist/oauth2.ts.

// Two Google desktop clients reach this same API, and each publishes its own
// id, secret and - critically - a Google-hosted page that displays the
// authorization code for the user to copy. That hosted page is the only reason
// either flow works from a web page: the loopback redirect both also register
// lands on a dead port a hosted page can neither listen on nor read.
//
// Which redirects a client accepts is not documented; it was established by
// asking Google's authorize endpoint and reading which ones answer
// redirect_uri_mismatch. Do that before adding a third.
export const AUTH_PROVIDERS = {
  'gemini-cli': {
    label: 'Gemini CLI',
    supported: true,
    // packages/core/src/code_assist/oauth2.ts
    clientId: '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com',
    clientSecret: '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',
    redirectUri: 'https://codeassist.google.com/authcode',
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
  },
  antigravity: {
    label: 'Antigravity',
    // Signs in and reports an eligible free tier, but its models 404 from a
    // browser: they are served only to Antigravity's own User-Agent, which no
    // web page may send. Kept because the sign-in itself is sound, and a proxy
    // or an extension could reach them.
    supported: false,
    clientId: '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
    clientSecret: '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',
    // Titled "Google Antigravity Authentication", with a Copy to Clipboard
    // button - a friendlier page than gemini-cli's.
    redirectUri: 'https://antigravity.google/oauth-callback',
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/cclog',
      'https://www.googleapis.com/auth/experimentsandconfigs',
    ],
  },
};

// gemini-cli, because from a browser it is the one that actually generates.
//
// The User-Agent decides which model vocabulary this API serves, and a browser
// cannot set it - it is a forbidden header name, so every request carries the
// browser's own string whatever the code asks for. Under that UA the gemini-cli
// models work and Antigravity's 404 on every host and project, whichever OAuth
// client presented the token. Verified against a live account.
//
// An earlier reading of this said the opposite - that gemini-cli was retired,
// because loadCodeAssist answered UNSUPPORTED_CLIENT. That was an artifact of
// probing from Node, whose default User-Agent is not a browser's. The lesson is
// in the test, not the API: reproduce the client's real conditions, or the
// answer describes something nobody ships.
export const DEFAULT_PROVIDER = 'gemini-cli';

const providerOrThrow = (key) => {
  const provider = AUTH_PROVIDERS[key];
  if (!provider) throw new Error(`Unknown sign-in provider: ${key}`);
  return provider;
};

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// Per provider: two grants can be live at once, and mixing a verifier or a
// refresh token between clients fails as invalid_grant, which reads exactly
// like an expired code.
//
// Pinned per provider rather than derived from DEFAULT_PROVIDER: deriving them
// meant that changing the default repointed every saved grant at another
// client's key, signing people out of a working session for no visible reason.
const STORAGE_KEYS = {
  'gemini-cli': { verifier: 'graphible-code-assist-verifier', refresh: 'graphible-code-assist-refresh' },
  antigravity: { verifier: 'graphible-antigravity-verifier', refresh: 'graphible-antigravity-refresh' },
};

const verifierKey = (p) => STORAGE_KEYS[p]?.verifier ?? `graphible-${p}-verifier`;
const refreshKey = (p) => STORAGE_KEYS[p]?.refresh ?? `graphible-${p}-refresh`;

const base64Url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const randomVerifier = () => base64Url(crypto.getRandomValues(new Uint8Array(32)));

const challengeFor = async (verifier) =>
  base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));

// Access tokens live in memory only; they expire in an hour and there is no
// reason to persist them. The refresh token is stored so that signing in
// survives a reload - the same trade gemini-cli makes by writing it to disk.
const sessions = new Map();

export const isSignedIn = (p = DEFAULT_PROVIDER) => {
  const session = sessions.get(p);
  return Boolean(session?.token) && session.expiresAt > Date.now();
};
export const hasStoredGrant = (p = DEFAULT_PROVIDER) => Boolean(readStored(refreshKey(p)));
export const getAccountEmail = (p = DEFAULT_PROVIDER) => sessions.get(p)?.email ?? null;

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private-mode browsers throw here; sign-in still works for this tab.
  }
}

export const signOut = (p = DEFAULT_PROVIDER) => {
  sessions.delete(p);
  writeStored(refreshKey(p), null);
  writeStored(verifierKey(p), null);
};

// Step one: build the URL and hand it to the user. The verifier is kept in
// storage rather than memory so the flow survives the user opening the link in
// another tab and coming back.
export const beginSignIn = async (p = DEFAULT_PROVIDER) => {
  const provider = providerOrThrow(p);

  // Reuse any verifier from an unfinished attempt. Generating a fresh one per
  // click invalidates the code from a page the user already has open, which is
  // easy to hit: click, miss the popup, click again, then paste the first
  // page's code and get invalid_grant.
  const verifier = readStored(verifierKey(p)) || randomVerifier();
  writeStored(verifierKey(p), verifier);

  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: provider.redirectUri,
    response_type: 'code',
    scope: provider.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256',
  });

  return `${AUTH_ENDPOINT}?${params}`;
};

const postToken = async (body) => {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // The raw pair is what actually identifies the failure; the friendly text
    // alone made a 400 indistinguishable from any other 400.
    console.error('Google token exchange failed:', data.error, data.error_description);
    throw new Error(describeTokenError(data));
  }
  return data;
};

// Step two: trade the pasted code for tokens. Users paste all sorts of things,
// so a full redirect URL or a "code=..." fragment is accepted as readily as
// the bare code.
export const completeSignIn = async (pasted, p = DEFAULT_PROVIDER) => {
  const provider = providerOrThrow(p);
  const code = extractAuthCode(pasted);
  if (!code) throw new Error('That does not look like an authorization code. Copy the whole code from the Google page.');

  const verifier = readStored(verifierKey(p));
  if (!verifier) throw new Error('This sign-in expired. Start it again.');

  const data = await postToken({
    code,
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    code_verifier: verifier,
    redirect_uri: provider.redirectUri,
    grant_type: 'authorization_code',
  });

  writeStored(verifierKey(p), null);
  if (data.refresh_token) writeStored(refreshKey(p), data.refresh_token);
  sessions.set(p, toSession(data, p));
  return sessions.get(p);
};

const toSession = (data, p) => ({
  token: data.access_token,
  // A minute of margin, so a request is never sent with a token that expires
  // while it is in flight.
  expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 - 60_000,
  // A refresh response carries no id_token, so keep the name already known.
  email: emailFromIdToken(data.id_token) ?? sessions.get(p)?.email ?? null,
});

// Returns a usable access token, refreshing from the stored grant when the
// current one has aged out. Rejects when the user needs to sign in again.
export const getAccessToken = async (p = DEFAULT_PROVIDER) => {
  if (isSignedIn(p)) return sessions.get(p).token;

  const provider = providerOrThrow(p);
  const refreshToken = readStored(refreshKey(p));
  if (!refreshToken) throw new Error('Sign in with Google to use your Gemini allowance.');

  const data = await postToken({
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  sessions.set(p, toSession(data, p));
  return sessions.get(p).token;
};

const safeDecode = (value) => {
  if (!/%[0-9a-f]{2}/i.test(value)) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const extractAuthCode = (pasted) => {
  const text = (pasted ?? '').trim();
  if (!text) return '';

  // A pasted URL, or a bare `code=...` pair.
  const match = text.match(/(?:^|[?&#])code=([^&\s]+)/);
  if (match) return safeDecode(match[1]);

  // Otherwise assume the whole string is the code; Google's codes carry a
  // slash and are never whitespace-separated. Some surfaces show it
  // percent-encoded (4%2F0...), which Google rejects if sent back as-is.
  const bare = text.replace(/^["'`]+|["'`]+$/g, '');
  return /\s/.test(bare) ? '' : safeDecode(bare);
};

// The id_token is only read to show which account is signed in. It is not
// used for authorization, so the signature is deliberately not verified.
export const emailFromIdToken = (idToken) => {
  if (!idToken) return null;
  try {
    const payload = idToken.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json).email ?? null;
  } catch {
    return null;
  }
};

export const describeTokenError = (data) => {
  switch (data?.error) {
    case 'invalid_grant':
      return 'Google rejected that code. Codes work once and expire after a few '
        + 'minutes - click Sign in again and use the code from the new page.';
    case 'invalid_request':
      return 'That code was not accepted. Make sure you copied all of it.';
    default:
      return data?.error_description || data?.error || 'Could not complete Google sign-in.';
  }
};

export const CODE_ASSIST_SCOPES = AUTH_PROVIDERS[DEFAULT_PROVIDER].scopes;
export const CODE_ASSIST_REDIRECT = AUTH_PROVIDERS[DEFAULT_PROVIDER].redirectUri;
