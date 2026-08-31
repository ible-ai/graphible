// Exercises the Code Assist backends against a real account, from Node.
//
// Everything about these paths that went wrong went wrong at the boundary the
// unit tests cannot reach: which host serves which model, which project a
// grant resolves to, which headers survive CORS. Each of those cost a
// round-trip through a human with a browser. This needs one instead: a refresh
// token for a throwaway Google account, and it answers all of them at once.
//
// Setup, once:
//   1. Sign in through the app with the account you want to test.
//   2. In the browser console:
//        localStorage.getItem('graphible-antigravity-refresh')   // or -code-assist-
//   3. Save it:  echo '<token>' > .env/antigravity-refresh
//      (.env/ is gitignored, and a throwaway account's Gemini allowance is the
//       entire blast radius.)
//
// Usage:  node scripts/probe-code-assist.mjs [gemini-cli|antigravity]

import { readFileSync } from 'node:fs';

const PROVIDERS = {
  'gemini-cli': {
    clientId: '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com',
    clientSecret: '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',
    tokenFile: '.env/code-assist-refresh',
    hosts: ['https://cloudcode-pa.googleapis.com'],
    models: ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-pro'],
    metadata: { pluginType: 'GEMINI' },
  },
  antigravity: {
    clientId: '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
    clientSecret: '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',
    tokenFile: '.env/antigravity-refresh',
    hosts: [
      'https://daily-cloudcode-pa.sandbox.googleapis.com',
      'https://autopush-cloudcode-pa.sandbox.googleapis.com',
      'https://cloudcode-pa.googleapis.com',
    ],
    models: ['gemini-3-flash', 'gemini-3-pro-low', 'gemini-3.1-pro-low', 'gemini-3.1-pro-high'],
    metadata: { pluginType: 'GEMINI', ideType: 'ANTIGRAVITY' },
  },
};

const name = process.argv[2] ?? 'antigravity';
const provider = PROVIDERS[name];
if (!provider) {
  console.error(`Unknown provider ${name}. Try: ${Object.keys(PROVIDERS).join(', ')}`);
  process.exit(1);
}

let refreshToken;
try {
  refreshToken = readFileSync(provider.tokenFile, 'utf8').trim();
} catch {
  console.error(`No token at ${provider.tokenFile}. See the setup notes at the top of this file.`);
  process.exit(1);
}

const token = await (async () => {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${data.error} ${data.error_description ?? ''}`);
  return data.access_token;
})();

// A browser User-Agent, because this API selects the model vocabulary from it
// and answers UNSUPPORTED_CLIENT to a string it does not recognise - which is
// what Node sends by default, and what once produced a confident, wrong
// conclusion that Google had retired the whole client. The browser cannot set
// this header at all (it is forbidden to fetch), so sending a browser's own
// string is what reproduces the app's real conditions rather than faking them.
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
  + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'User-Agent': BROWSER_UA,
};
const post = (host, method, body, query = '') =>
  fetch(`${host}/v1internal:${method}${query}`, { method: 'POST', headers, body: JSON.stringify(body) });

const errorOf = async (res) => {
  const text = await res.text();
  try { return JSON.parse(text)?.error?.message ?? ''; } catch { return text.slice(0, 100); }
};

console.log(`\n== ${name}: which project does each host resolve?`);
const projects = new Set();
for (const host of provider.hosts) {
  const res = await post(host, 'loadCodeAssist', { metadata: provider.metadata });
  const data = await res.json().catch(() => ({}));
  if (data.cloudaicompanionProject) projects.add(data.cloudaicompanionProject);
  console.log(`  ${res.status}  ${new URL(host).hostname}  project=${data.cloudaicompanionProject ?? '-'}`
    + `  tier=${data.currentTier?.id ?? '-'}  ${data.error?.message ?? ''}`);
}

console.log(`\n== what the account's own quota says it may use`);
for (const project of projects) {
  for (const host of provider.hosts) {
    const res = await post(host, 'retrieveUserQuota', { project });
    if (!res.ok) { console.log(`  ${res.status}  ${new URL(host).hostname}  ${await errorOf(res)}`); continue; }
    const { buckets = [] } = await res.json();
    console.log(`  ok    ${new URL(host).hostname}  ${buckets.map((b) => b.modelId).filter(Boolean).join(', ') || '(no model buckets)'}`);
  }
}

console.log(`\n== which host + project + model actually generates`);
const candidates = [...projects, 'rising-fact-p41fc', undefined];
for (const host of provider.hosts) {
  for (const project of candidates) {
    for (const model of provider.models) {
      const res = await post(host, 'generateContent', {
        model,
        ...(project ? { project } : {}),
        request: { contents: [{ role: 'user', parts: [{ text: 'hi' }] }] },
      });
      const label = `${new URL(host).hostname.split('.')[0]} / ${project ?? 'no-project'} / ${model}`;
      console.log(res.ok ? `  OK    ${label}` : `  ${res.status}   ${label}  ${(await errorOf(res)).slice(0, 80)}`);
    }
  }
}
