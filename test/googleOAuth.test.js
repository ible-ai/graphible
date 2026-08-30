import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLLMConnection } from '../src/hooks/useLLMConnection';
import * as googleAuth from '../src/utils/googleAuth';

// Reads a backend's stream the way useGraphState does. Every backend has to
// satisfy this shape, whatever it talks to underneath.
const drain = async (response) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value, { stream: true }).split('\n')) {
      if (line.trim()) text += JSON.parse(line).response ?? '';
    }
  }
  return text;
};

// Gemini streams server-sent events: one `data:` line per chunk. Splitting the
// body at arbitrary byte offsets is the interesting case, since a real network
// read can land mid-line.
const sseStream = (chunks, { splitAt } = {}) => {
  const body = chunks
    .map((text) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`)
    .join('');
  const encoder = new TextEncoder();
  const pieces = splitAt
    ? [body.slice(0, splitAt), body.slice(splitAt)]
    : [body];

  return new ReadableStream({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
};

const OAUTH_CONFIG = {
  type: 'google-oauth', provider: 'google', model: 'gemini-3.5-flash-lite', projectId: 'proj-1',
};

describe('useLLMConnection, google-oauth backend', () => {
  beforeEach(() => {
    vi.spyOn(googleAuth, 'getAccessToken').mockResolvedValue('ya29.fake-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the shared envelope rather than a raw Gemini response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, body: sseStream(['hi']) })));
    const { result } = renderHook(() => useLLMConnection());

    const response = await result.current.generateWithLLM('prompt', true, OAUTH_CONFIG);

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(ReadableStream);
  });

  it('sends the token as a bearer header, not as a key parameter', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, body: sseStream(['x']) }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useLLMConnection());

    await result.current.generateWithLLM('prompt', true, OAUTH_CONFIG);

    const [url, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer ya29.fake-token');
    expect(url).not.toContain('key=');
    // Without alt=sse the endpoint returns one growing JSON array, which
    // cannot be parsed incrementally and so cannot stream into the graph.
    expect(url).toContain('alt=sse');
  });

  it('always names a quota project, so the bill follows the user', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, body: sseStream(['x']) }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useLLMConnection());

    await result.current.generateWithLLM('p', true, OAUTH_CONFIG);
    expect(fetchMock.mock.calls[0][1].headers['x-goog-user-project']).toBe('proj-1');
  });

  it('refuses to send a request with no project rather than billing the host', async () => {
    // Google falls back to the OAuth client's own project, which belongs to
    // whoever deployed Graphible. Sending is the expensive failure mode, so
    // the request never leaves.
    const fetchMock = vi.fn(async () => ({ ok: true, body: sseStream(['x']) }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useLLMConnection());

    const { projectId: _dropped, ...noProject } = OAUTH_CONFIG;
    await expect(
      result.current.generateWithLLM('p', true, noProject)
    ).rejects.toThrow(/project/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reassembles text across chunks, including a chunk split mid-line', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      body: sseStream(['Hello ', 'from ', 'Gemini'], { splitAt: 40 }),
    })));
    const { result } = renderHook(() => useLLMConnection());

    const response = await result.current.generateWithLLM('p', true, OAUTH_CONFIG);
    expect(await drain(response)).toBe('Hello from Gemini');
  });

  it('sends generation settings as generationConfig, which is what REST reads', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, body: sseStream(['x']) }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useLLMConnection());

    await result.current.generateWithLLM('p', true, OAUTH_CONFIG);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.temperature).toEqual(expect.any(Number));
    expect(body.contents[0].parts[0].text).toBe('p');
  });

  it('translates a retired model id into something actionable', async () => {
    // Google answers a retired id with 404 and an empty body, so without this
    // the failure reaches the user as silence.
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 404, text: async () => '',
    })));
    const { result } = renderHook(() => useLLMConnection());

    await expect(
      result.current.generateWithLLM('p', true, OAUTH_CONFIG)
    ).rejects.toThrow(/no longer available/i);
  });

  it('tells the user to sign in again when the token has expired', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 401, text: async () => JSON.stringify({ error: { message: 'bad creds' } }),
    })));
    const { result } = renderHook(() => useLLMConnection());

    await expect(
      result.current.generateWithLLM('p', true, OAUTH_CONFIG)
    ).rejects.toThrow(/sign in again/i);
  });

  it('names the missing quota project rather than echoing Google wording', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: { message: 'requires a quota project' } }),
    })));
    const { result } = renderHook(() => useLLMConnection());

    await expect(
      result.current.generateWithLLM('p', true, OAUTH_CONFIG)
    ).rejects.toThrow(/Cloud project/i);
  });
});

describe('google sign-in configuration', () => {
  it('stays hidden unless the build carries a client id', () => {
    // Rendering a sign-in button with no client id gives the user something
    // that can only ever fail.
    const configured = googleAuth.isGoogleSignInConfigured();
    expect(typeof configured).toBe('boolean');
    expect(configured).toBe(Boolean(import.meta.env?.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim()));
  });

  it('asks for exactly the scope the API named in its own challenge', () => {
    expect(googleAuth.GEMINI_SCOPE).toBe('https://www.googleapis.com/auth/generative-language');
  });
});
