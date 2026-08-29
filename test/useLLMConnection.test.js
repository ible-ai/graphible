import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLLMConnection } from '../src/hooks/useLLMConnection';

// Reads a backend's stream the way useGraphState does: decode each chunk,
// JSON.parse it, take .response. Every backend must satisfy this shape.
const drain = async (response) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value, { stream: true }).split('\n')) {
      if (!line.trim()) continue;
      text += JSON.parse(line).response ?? '';
    }
  }
  return text;
};

describe('useLLMConnection, demo backend', () => {
  it('defaults to demo so the app is usable with nothing configured', () => {
    const { result } = renderHook(() => useLLMConnection());
    expect(result.current.currentModel.type).toBe('demo');
  });

  it('reports demo as connected without touching the network', async () => {
    const { result } = renderHook(() => useLLMConnection());

    await act(async () => {
      const ok = await result.current.testLLMConnection({ type: 'demo' });
      expect(ok).toBe(true);
    });
    await waitFor(() => expect(result.current.llmConnected).toBe('connected'));
  });

  it('returns the shared envelope: ok, status, and a ReadableStream body', async () => {
    const { result } = renderHook(() => useLLMConnection());

    const response = await result.current.generateWithLLM('anything', true, { type: 'demo' });
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(ReadableStream);
  });

  it('streams chunks that parse as {"response": "..."} and carry node JSON', async () => {
    const { result } = renderHook(() => useLLMConnection());

    const response = await result.current.generateWithLLM('anything', true, { type: 'demo' });
    const text = await drain(response);
    const node = JSON.parse(text);

    // The envelope must survive round-tripping into a real node.
    expect(node).toMatchObject({
      label: expect.any(String),
      type: expect.any(String),
      description: expect.any(String),
      content: expect.any(String),
    });
  });

  it('offers a json() body instead of a stream when stream is false', async () => {
    const { result } = renderHook(() => useLLMConnection());

    const response = await result.current.generateWithLLM('anything', false, { type: 'demo' });
    expect(response.ok).toBe(true);
    const { response: payload } = await response.json();
    expect(JSON.parse(payload)).toHaveProperty('label');
  });

  it('rejects an unknown backend type rather than failing silently', async () => {
    const { result } = renderHook(() => useLLMConnection());
    await expect(
      result.current.generateWithLLM('x', true, { type: 'not-a-backend' })
    ).rejects.toThrow(/unknown model type/i);
  });
});
