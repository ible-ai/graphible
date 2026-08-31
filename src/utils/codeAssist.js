// The Code Assist wire format, which is not the Gemini Developer API's.
//
// Requests wrap the Vertex-shaped payload in an envelope carrying the model
// and project; responses wrap the candidates in a `response` field. Shapes are
// from packages/core/src/code_assist/converter.ts and server.ts.

import { getAccessToken, DEFAULT_PROVIDER } from './codeAssistAuth';

const ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const VERSION = 'v1internal';

const methodUrl = (method) => `${ENDPOINT}/${VERSION}:${method}`;

// Antigravity's own client announces itself here, and its newer models are
// served to that client. A browser refuses to let fetch set User-Agent, which
// the desktop app also sends - if the backend requires it, this is where that
// shows up, as a refusal rather than a wrong answer.
const CLIENT_METADATA = {
  antigravity: '{"ideType":"ANTIGRAVITY","platform":"PLATFORM_UNSPECIFIED","pluginType":"GEMINI"}',
};

const authHeaders = (token, provider = DEFAULT_PROVIDER) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  ...(CLIENT_METADATA[provider] ? { 'Client-Metadata': CLIENT_METADATA[provider] } : {}),
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

// Discovers the project Code Assist wants requests attributed to. Free-tier
// accounts are handed one automatically; nothing is created here.
export const loadCodeAssist = async (provider = DEFAULT_PROVIDER) => {
  const token = await getAccessToken(provider);
  const response = await fetch(methodUrl('loadCodeAssist'), {
    method: 'POST',
    headers: authHeaders(token, provider),
    body: JSON.stringify({
      metadata: provider === 'antigravity'
        ? { pluginType: 'GEMINI', ideType: 'ANTIGRAVITY' }
        : { pluginType: 'GEMINI' },
    }),
  });

  if (!response.ok) throw new Error(await describeError(response));

  const data = await response.json();
  return {
    project: data.cloudaicompanionProject ?? null,
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
  const token = await getAccessToken(config?.provider ?? DEFAULT_PROVIDER);
  const response = await fetch(`${methodUrl('streamGenerateContent')}?alt=sse`, {
    method: 'POST',
    headers: authHeaders(token, config?.provider ?? DEFAULT_PROVIDER),
    body: requestBody(prompt, config),
  });

  if (!response.ok) throw new Error(await describeError(response));
  return response.body;
};

export const generateContent = async (prompt, config) => {
  const token = await getAccessToken(config?.provider ?? DEFAULT_PROVIDER);
  const response = await fetch(methodUrl('generateContent'), {
    method: 'POST',
    headers: authHeaders(token, config?.provider ?? DEFAULT_PROVIDER),
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
  const token = await getAccessToken(provider);
  const response = await fetch(methodUrl('retrieveUserQuota'), {
    method: 'POST',
    headers: authHeaders(token, provider),
    body: JSON.stringify({ project }),
  });

  if (!response.ok) throw new Error(await describeError(response));
  return response.json();
};

// Internal variants and non-chat models: real buckets, but not things to offer
// as a model to talk to.
const OFFERABLE = (id) => id && !/customtools|embedding/.test(id);

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
