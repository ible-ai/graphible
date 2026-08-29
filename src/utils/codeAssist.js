// The Code Assist wire format, which is not the Gemini Developer API's.
//
// Requests wrap the Vertex-shaped payload in an envelope carrying the model
// and project; responses wrap the candidates in a `response` field. Shapes are
// from packages/core/src/code_assist/converter.ts and server.ts.

import { getAccessToken } from './codeAssistAuth';

const ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const VERSION = 'v1internal';

const methodUrl = (method) => `${ENDPOINT}/${VERSION}:${method}`;

const authHeaders = (token) => ({
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
export const loadCodeAssist = async () => {
  const token = await getAccessToken();
  const response = await fetch(methodUrl('loadCodeAssist'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ metadata: { pluginType: 'GEMINI' } }),
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
  const token = await getAccessToken();
  const response = await fetch(`${methodUrl('streamGenerateContent')}?alt=sse`, {
    method: 'POST',
    headers: authHeaders(token),
    body: requestBody(prompt, config),
  });

  if (!response.ok) throw new Error(await describeError(response));
  return response.body;
};

export const generateContent = async (prompt, config) => {
  const token = await getAccessToken();
  const response = await fetch(methodUrl('generateContent'), {
    method: 'POST',
    headers: authHeaders(token),
    body: requestBody(prompt, config),
  });

  if (!response.ok) throw new Error(await describeError(response));
  return textFromChunk(await response.json());
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
