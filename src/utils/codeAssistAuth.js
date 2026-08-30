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

const CLIENT_ID = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';
const CLIENT_SECRET = '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';

const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// A Google-hosted page that displays the authorization code for the user to
// copy. gemini-cli uses it for its no-browser flow, and it is the reason this
// works from a web page at all: the loopback redirect it uses otherwise lands
// on a dead port that a hosted page can neither listen on nor read.
const REDIRECT_URI = 'https://codeassist.google.com/authcode';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

const VERIFIER_KEY = 'graphible-code-assist-verifier';
const REFRESH_KEY = 'graphible-code-assist-refresh';

const base64Url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const randomVerifier = () => base64Url(crypto.getRandomValues(new Uint8Array(32)));

const challengeFor = async (verifier) =>
  base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));

// Access tokens live in memory only; they expire in an hour and there is no
// reason to persist them. The refresh token is stored so that signing in
// survives a reload - the same trade gemini-cli makes by writing it to disk.
let session = null;

export const isSignedIn = () => Boolean(session?.token) && session.expiresAt > Date.now();
export const hasStoredGrant = () => Boolean(readStored(REFRESH_KEY));
export const getAccountEmail = () => session?.email ?? null;

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

export const signOut = () => {
  session = null;
  writeStored(REFRESH_KEY, null);
  writeStored(VERIFIER_KEY, null);
};

// Step one: build the URL and hand it to the user. The verifier is kept in
// storage rather than memory so the flow survives the user opening the link in
// another tab and coming back.
export const beginSignIn = async () => {
  // Reuse any verifier from an unfinished attempt. Generating a fresh one per
  // click invalidates the code from a page the user already has open, which is
  // easy to hit: click, miss the popup, click again, then paste the first
  // page's code and get invalid_grant.
  const verifier = readStored(VERIFIER_KEY) || randomVerifier();
  writeStored(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
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
export const completeSignIn = async (pasted) => {
  const code = extractAuthCode(pasted);
  if (!code) throw new Error('That does not look like an authorization code. Copy the whole code from the Google page.');

  const verifier = readStored(VERIFIER_KEY);
  if (!verifier) throw new Error('This sign-in expired. Start it again.');

  const data = await postToken({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  writeStored(VERIFIER_KEY, null);
  if (data.refresh_token) writeStored(REFRESH_KEY, data.refresh_token);
  session = toSession(data);
  return session;
};

const toSession = (data) => ({
  token: data.access_token,
  // A minute of margin, so a request is never sent with a token that expires
  // while it is in flight.
  expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 - 60_000,
  email: emailFromIdToken(data.id_token) ?? session?.email ?? null,
});

// Returns a usable access token, refreshing from the stored grant when the
// current one has aged out. Rejects when the user needs to sign in again.
export const getAccessToken = async () => {
  if (isSignedIn()) return session.token;

  const refreshToken = readStored(REFRESH_KEY);
  if (!refreshToken) throw new Error('Sign in with Google to use your Gemini allowance.');

  const data = await postToken({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  session = toSession(data);
  return session.token;
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

export const CODE_ASSIST_SCOPES = SCOPES;
export const CODE_ASSIST_REDIRECT = REDIRECT_URI;
