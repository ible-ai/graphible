import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getModelConsent,
  setModelConsent,
  clearModelConsent,
  isModelCached,
} from '../src/utils/modelConsent';

const A = 'onnx-community/gemma-3-270m-it-ONNX';
const B = 'onnx-community/Qwen3-0.6B-ONNX';

beforeEach(() => localStorage.clear());

describe('per-model consent', () => {
  it('reports nothing recorded for a model never asked about', () => {
    expect(getModelConsent(A)).toBeNull();
  });

  it('records a grant and a denial separately', () => {
    setModelConsent(A, true);
    setModelConsent(B, false);

    expect(getModelConsent(A)).toBe(true);
    expect(getModelConsent(B)).toBe(false);
  });

  it('does not let one model\'s grant stand in for another', () => {
    // The reported bug: consent was one global flag, so approving an older
    // model counted as approving a newly chosen one and the prompt never
    // appeared for the model actually being downloaded.
    setModelConsent(B, true);
    expect(getModelConsent(A)).toBeNull();
  });

  it('does not let a stale denial block a different model', () => {
    setModelConsent(B, false);
    expect(getModelConsent(A)).toBeNull();
  });

  it('forgets a model so it can be asked about again', () => {
    setModelConsent(A, true);
    clearModelConsent(A);
    expect(getModelConsent(A)).toBeNull();
  });

  it('ignores the old global consent key entirely', () => {
    localStorage.setItem('graphible-webllm-consent', 'granted');
    expect(getModelConsent(A)).toBeNull();
  });

  it('survives corrupt storage rather than throwing', () => {
    localStorage.setItem('graphible-webllm-consent-v2', 'not json');
    expect(getModelConsent(A)).toBeNull();
    expect(() => setModelConsent(A, true)).not.toThrow();
  });

  it('treats a missing model id as nothing recorded', () => {
    expect(getModelConsent(undefined)).toBeNull();
    expect(() => setModelConsent(undefined, true)).not.toThrow();
  });
});

describe('cache detection', () => {
  it('reports false when Cache Storage is unavailable', async () => {
    expect(await isModelCached(A)).toBe(false);
  });

  it('treats a model whose weights are already cached as needing no download', async () => {
    vi.stubGlobal('caches', {
      keys: async () => ['transformers-cache'],
      open: async () => ({
        keys: async () => [
          { url: `https://huggingface.co/${A}/resolve/main/onnx/model_q4f16.onnx` },
        ],
      }),
    });

    expect(await isModelCached(A)).toBe(true);
    vi.unstubAllGlobals();
  });

  it('does not mistake an unrelated cached file for the model', async () => {
    vi.stubGlobal('caches', {
      keys: async () => ['transformers-cache'],
      open: async () => ({ keys: async () => [{ url: 'https://example.com/app.js' }] }),
    });

    expect(await isModelCached(A)).toBe(false);
    vi.unstubAllGlobals();
  });
});
