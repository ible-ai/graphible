// Sign in with Google, for calling the Gemini API as the signed-in user.
//
// Graphible is a static site with no backend, so this uses Google Identity
// Services' implicit token flow: the browser receives an access token directly
// and no client secret is involved. Tokens are short-lived (~1h) and are held
// in memory only - a bearer token in localStorage is readable by anything that
// manages to run script on the page, and unlike an API key it cannot be scoped
// or revoked per-app by the user.
//
// The API accepts these tokens; it names the scope itself when you send one
// without it:
//   www-authenticate: Bearer error="insufficient_scope",
//     scope="https://www.googleapis.com/auth/generative-language ..."

const GIS_SRC = 'https://accounts.google.com/gsi/client';

export const GEMINI_SCOPE = 'https://www.googleapis.com/auth/generative-language';

// Set at build time. Without it the sign-in option stays hidden rather than
// rendering a button that can only fail.
export const getClientId = () =>
  import.meta.env?.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim() || '';

export const isGoogleSignInConfigured = () => Boolean(getClientId());

let gisPromise = null;

// Loads the Google Identity Services script once, shared across callers.
export const loadGis = () => {
  if (gisPromise) return gisPromise;

  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve(window.google.accounts.oauth2);
      return;
    }

    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    const script = existing ?? document.createElement('script');

    script.addEventListener('load', () => {
      if (window.google?.accounts?.oauth2) resolve(window.google.accounts.oauth2);
      else reject(new Error('Google sign-in loaded but exposed no OAuth client'));
    });
    script.addEventListener('error', () =>
      reject(new Error('Could not reach Google sign-in. Check your connection or blockers.'))
    );

    if (!existing) {
      script.src = GIS_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    // Otherwise one offline attempt poisons every retry for the session.
    gisPromise = null;
    throw error;
  });

  return gisPromise;
};

// The live token, in memory. `expiresAt` is deliberately pessimistic by a
// minute so a request is not sent with a token that expires mid-flight.
const EXPIRY_MARGIN_MS = 60_000;
let session = null;

export const getSession = () => session;
export const isSignedIn = () =>
  Boolean(session?.token) && session.expiresAt > Date.now();

export const clearSession = () => {
  const previous = session;
  session = null;
  // Best effort; the token is dead to us either way.
  if (previous?.token) {
    window.google?.accounts?.oauth2?.revoke?.(previous.token, () => {});
  }
};

// Opens Google's consent popup and resolves with the access token.
//
// `prompt: ''` lets Google skip the account chooser once the user has already
// granted the scope, so a token refresh is silent rather than a second popup.
export const signIn = async ({ silent = false } = {}) => {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error(
      'Google sign-in is not configured for this build (VITE_GOOGLE_OAUTH_CLIENT_ID).'
    );
  }

  const oauth2 = await loadGis();

  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: GEMINI_SCOPE,
      prompt: silent ? '' : 'consent',
      callback: (response) => {
        if (response.error) {
          reject(new Error(describeAuthError(response)));
          return;
        }
        session = {
          token: response.access_token,
          // expires_in is seconds; Google omits it in some error paths.
          expiresAt: Date.now() + (Number(response.expires_in) || 3600) * 1000 - EXPIRY_MARGIN_MS,
          scope: response.scope,
        };
        resolve(session);
      },
      error_callback: (error) => reject(new Error(describeAuthError(error))),
    });

    client.requestAccessToken();
  });
};

// Returns a usable token, refreshing silently when the current one has aged
// out. Callers should treat a rejection as "ask the user to sign in again".
export const getAccessToken = async () => {
  if (isSignedIn()) return session.token;
  const refreshed = await signIn({ silent: true });
  return refreshed.token;
};

export const describeAuthError = (error) => {
  const type = error?.type ?? error?.error;
  switch (type) {
    case 'popup_closed':
    case 'popup_closed_by_user':
      return 'Sign-in was closed before it finished.';
    case 'popup_failed_to_open':
      return 'Google sign-in was blocked. Allow pop-ups for this site and try again.';
    case 'access_denied':
      return 'Google sign-in was declined.';
    case 'invalid_scope':
      // Worth distinguishing: this means the OAuth client is not permitted to
      // ask for the Gemini scope, not that the user did anything wrong.
      return 'This build is not authorised to use the Gemini scope.';
    default:
      return error?.error_description || error?.message || 'Google sign-in failed.';
  }
};
