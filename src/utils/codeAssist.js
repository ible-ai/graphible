// The Code Assist wire format, which is not the Gemini Developer API's.
//
// Requests wrap the Vertex-shaped payload in an envelope carrying the model
// and project; responses wrap the candidates in a `response` field. Shapes are
// from packages/core/src/code_assist/converter.ts and server.ts.

import { getAccessToken, DEFAULT_PROVIDER } from './codeAssistAuth';

const PROD = 'https://cloudcode-pa.googleapis.com';
// The host Antigravity's own CLI logs show it using. Not the `.sandbox` one a
// third-party plugin's constants name - that resolves and answers, which is
// what made the mistake survive: it 404s every model instead of failing loudly.
const DAILY = 'https://daily-cloudcode-pa.googleapis.com';
const VERSION = 'v1internal';

// Antigravity's models are not served by prod - asking it for gemini-3-flash
// there returns a bare 404, which reads as a bad model id rather than a wrong
// host.
const ENDPOINTS = {
  'gemini-cli': { generate: [PROD], load: [PROD] },
  // daily first: with Antigravity's own User-Agent it resolves the
  // `aicode-consumers` project, which is the one its models are served under.
  antigravity: { generate: [DAILY, PROD], load: [DAILY, PROD] },
};

export // An unrecognised provider gets prod-only routing rather than whatever the
// current default happens to be: prod is the conservative choice, and tying
// this to DEFAULT_PROVIDER would quietly re-route it whenever that changes.
const endpointsFor = (provider, kind) =>
  (ENDPOINTS[provider] ?? ENDPOINTS['gemini-cli'])[kind];

const methodUrl = (method, endpoint = PROD) => `${endpoint}/${VERSION}:${method}`;

// Tries each endpoint in turn, giving up on the first that answers anything
// other than "no such method or model here". A 404 from one host says nothing
// about the next; any other status is the answer.
const postToEndpoints = async (method, { provider, kind, body, query = '' }) => {
  const token = await getAccessToken(provider);
  const hosts = endpointsFor(provider, kind);
  let last = null;

  for (const host of hosts) {
    const response = await fetch(`${methodUrl(method, host)}${query}`, {
      method: 'POST',
      headers: authHeaders(token),
      body,
    });
    if (response.status !== 404) return response;
    last = response;
  }
  return last;
};

// This API's CORS allowlist is exactly `authorization,content-type`. Any other
// header - Client-Metadata, which the desktop clients send - makes the
// *preflight* fail with 403, so the real request is never sent and the browser
// reports only "No 'Access-Control-Allow-Origin' header", naming nothing.
// Identifying the client has to happen in the body instead.
export const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const describeError = async (response) => {
  const raw = await response.text().catch(() => '');
  let message = '';
  try {
    message = JSON.parse(raw)?.error?.message ?? '';
  } catch {
    message = raw.slice(0, 200);
  }

  if (response.status === 401) {
    return 'Your Google sign-in expired. Sign in again to continue.';
  }
  if (response.status === 404 || /not be found|was not found/i.test(message)) {
    // Code Assist and the Developer API do not share a model vocabulary, and
    // Google names neither the entity nor the field it objected to.
    return 'Code Assist does not offer that model. Pick another in the model menu.';
  }
  if (response.status === 403) {
    // Most often an account whose tier is not served by this API.
    return message || 'Google declined this request for your account.';
  }
  if (response.status === 429) {
    return "You've used up your Gemini allowance for now. Try again later, or switch models.";
  }
  return message || `Code Assist request failed: ${response.status}`;
};

// Provisions the managed project for accounts that do not have one yet.
//
// Without it, generation fails with "You do not have a valid license of this
// product (#3501)" - which reads as an account problem and is really a missing
// project. onboardUser returns a long-running operation, so it is polled until
// it settles. The free tier must NOT name a project in the request; doing so
// returns Precondition Failed.
const onboardUser = async (provider, loaded) => {
  const tier = loaded.allowedTiers?.find((t) => t.isDefault)
    ?? { id: 'legacy-tier', userDefinedCloudaicompanionProject: true };

  const body = JSON.stringify({
    tierId: tier.id,
    metadata: provider === 'antigravity'
      ? { pluginType: 'GEMINI', ideType: 'ANTIGRAVITY' }
      : { pluginType: 'GEMINI' },
  });

  let operation = await (await postToEndpoints('onboardUser', { provider, kind: 'load', body })).json();

  // Bounded: an operation that never settles must not hang the first prompt.
  for (let attempt = 0; !operation.done && operation.name && attempt < 6; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const polled = await postToEndpoints('onboardUser', { provider, kind: 'load', body });
    operation = await polled.json();
  }

  // A standard-tier account answers 200 with an empty project object: it wants
  // one the user supplies, which is the billed path this avoids.
  return operation.response?.cloudaicompanionProject?.id ?? null;
};

// Discovers the project Code Assist wants requests attributed to. Accounts
// without one are onboarded here rather than left to fail at generation.
export const loadCodeAssist = async (provider = DEFAULT_PROVIDER) => {
  const response = await postToEndpoints('loadCodeAssist', {
    provider,
    kind: 'load',
    body: JSON.stringify({
      // The header this would otherwise ride in fails CORS preflight, so the
      // client identifies itself in the body - which is where gemini-cli's own
      // loadCodeAssist puts it too.
      metadata: provider === 'antigravity'
        ? { pluginType: 'GEMINI', ideType: 'ANTIGRAVITY' }
        : { pluginType: 'GEMINI' },
    }),
  });

  if (!response.ok) throw new Error(await describeError(response));

  const data = await response.json();
  const project = data.cloudaicompanionProject
    ?? (data.currentTier ? null : await onboardUser(provider, data));

  // Google explains a dead end here and nowhere else. Without this the user
  // gets "You do not have a valid license (#3501)" at generation time, which
  // reads as a billing problem and names no remedy - while this field says
  // exactly which client was retired and what to move to.
  if (!project && data.ineligibleTiers?.length) {
    throw new Error(data.ineligibleTiers[0].reasonMessage
      ?? 'Google will not serve this account through this sign-in.');
  }

  return {
    project,
    tier: data.currentTier?.id ?? data.allowedTiers?.find((t) => t.isDefault)?.id ?? null,
  };
};

const requestBody = (prompt, { model, project, generationConfig }) => JSON.stringify({
  model,
  ...(project ? { project } : {}),
  request: {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(generationConfig ? { generationConfig } : {}),
  },
});

// Candidates sit one level deeper than in the Developer API: the chunk is
// {response: {candidates: [...]}} rather than {candidates: [...]}.
export const textFromChunk = (chunk) =>
  (chunk?.response?.candidates ?? chunk?.candidates ?? [])
    .flatMap((candidate) => candidate?.content?.parts ?? [])
    .map((part) => part?.text ?? '')
    .join('');

export const streamGenerateContent = async (prompt, config) => {
  const response = await postToEndpoints('streamGenerateContent', {
    provider: config?.provider ?? DEFAULT_PROVIDER,
    kind: 'generate',
    query: '?alt=sse',
    body: requestBody(prompt, config),
  });

  if (!response.ok) throw new Error(await describeError(response));
  return response.body;
};

export const generateContent = async (prompt, config) => {
  const response = await postToEndpoints('generateContent', {
    provider: config?.provider ?? DEFAULT_PROVIDER,
    kind: 'generate',
    body: requestBody(prompt, config),
  });

  if (!response.ok) throw new Error(await describeError(response));
  return textFromChunk(await response.json());
};

// What models this account can actually use.
//
// The catalog in graphConstants is a guess that has to hold for everyone, so it
// can only name ids that need no per-account access - which is why picking a
// preview model off a changelog fails. This asks instead: retrieveUserQuota
// returns one bucket per model the account has an allowance for, and gemini-cli
// derives its own preview access the same way (config.js: hasAccess =
// quota.buckets.some(b => isPreviewModel(b.modelId))).
//
// Returns [] on any failure, which the caller reads as "use the static
// catalog" - so a bad response degrades to today's behaviour rather than an
// empty menu.
export const retrieveUserQuota = async (project, provider = DEFAULT_PROVIDER) => {
  const response = await postToEndpoints('retrieveUserQuota', {
    provider,
    kind: 'generate',
    body: JSON.stringify({ project }),
  });

  if (!response.ok) throw new Error(await describeError(response));
  return response.json();
};

// Real buckets, but not things to offer as a model to talk to: internal
// variants, non-chat models, and the agent/editor surfaces that share this
// quota (`chat_20706`, `tab_flash_lite_preview`, `gemini-pro-agent`).
const INTERNAL = /customtools|embedding|^chat_|^tab_|-agent$|-image$/;

// Anything older than Gemini 3 is not offered. The account still has quota for
// 2.5 and it still works - this is a product decision, not a capability one, so
// it lives here rather than being filtered out of the request path.
const supersededGemini = (id) => {
  const [, major] = id.match(/^gemini-(\d+)(?:\.\d+)?-/) ?? [];
  return major !== undefined && Number(major) < 3;
};

const OFFERABLE = (id) => Boolean(id) && !INTERNAL.test(id) && !supersededGemini(id);

export const modelsFromQuota = (quota) => {
  const seen = new Set();
  return (quota?.buckets ?? [])
    .map((bucket) => bucket?.modelId)
    .filter((id) => OFFERABLE(id) && !seen.has(id) && seen.add(id));
};

export const discoverModels = async (project, provider = DEFAULT_PROVIDER) => {
  try {
    return modelsFromQuota(await retrieveUserQuota(project, provider));
  } catch (error) {
    // Not worth surfacing: the static catalog still works.
    console.warn('Could not read your model allowance; using the built-in list.', error);
    return [];
  }
};

// Re-reads an SSE body into the app's envelope: one {"response": "..."} line
// per chunk. A network read can split mid-line, so the trailing partial is
// carried over rather than parsed.
export const sseToEnvelope = (body) => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let buffer = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;

            const text = textFromChunk(JSON.parse(payload));
            if (text) controller.enqueue(encoder.encode(JSON.stringify({ response: text }) + '\n'));
          }
        }
        controller.close();
      } catch (error) {
        console.error('Code Assist streaming error:', error);
        controller.error(error);
      }
    },
  });
};
