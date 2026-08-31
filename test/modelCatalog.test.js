import { describe, it, expect } from 'vitest';
import {
  LLM_CONFIG,
  DEFAULT_MODEL_CONFIGS,
  DEFAULT_WEBLLM_MODEL_INFO,
  GOOGLE_MODEL_LIST,
  BROWSER_LLM_TO_PROVIDER,
  BROWSER_LLM_PROVIDERS,
  RECOMMENDED_GOOGLE_MODEL,
  migrateModelConfig,
  CODE_ASSIST_MODELS,
  CODE_ASSIST_MODEL_LIST,
  DEFAULT_CODE_ASSIST_MODEL,
  DEFAULT_ANTIGRAVITY_MODEL,
  ANTIGRAVITY_MODELS,
} from '../src/constants/graphConstants';

// The catalogs used to be duplicated across ModelSelector, the wizard
// constants and InstallationGuide, and drifted: the wizard advertised a model
// the app never downloads, at roughly four times its real size. These keep the
// single source internally consistent.
describe('browser model catalog', () => {
  const ids = Object.keys(LLM_CONFIG.WEBLLM);

  it('routes every catalogued model to a provider, and routes nothing else', () => {
    const routed = [...BROWSER_LLM_TO_PROVIDER.keys()];
    expect(ids.filter((id) => !routed.includes(id))).toEqual([]);
    expect(routed.filter((id) => !ids.includes(id))).toEqual([]);
  });

  it('routes each model to a provider that exists', () => {
    const providers = Object.values(BROWSER_LLM_PROVIDERS);
    for (const [, provider] of BROWSER_LLM_TO_PROVIDER) {
      expect(providers).toContain(provider);
    }
  });

  it('gives every model a name, a dtype and a parseable download size', () => {
    for (const id of ids) {
      const model = LLM_CONFIG.WEBLLM[id];
      expect(model.name, id).toBeTruthy();
      expect(model.dtype, id).toBeTruthy();
      // WebLLMProgressTracker parses this for its MB counter and ETA.
      expect(model.size, id).toMatch(/^[\d.]+\s?(MB|GB)$/i);
    }
  });

  it('recommends exactly one model', () => {
    expect(ids.filter((id) => LLM_CONFIG.WEBLLM[id].recommended)).toHaveLength(1);
  });

  it('defaults to a model in the catalog, with a matching dtype', () => {
    const { model, dtype } = DEFAULT_MODEL_CONFIGS.WEBLLM;
    expect(LLM_CONFIG.WEBLLM[model]).toBeDefined();
    // A mismatch here is how the default came to advertise 0.6 GB while
    // actually pulling the 1.2 GB fp16 build.
    expect(dtype).toBe(LLM_CONFIG.WEBLLM[model].dtype);
  });

  it('exposes the default model info the wizard quotes', () => {
    expect(DEFAULT_WEBLLM_MODEL_INFO).toBe(
      LLM_CONFIG.WEBLLM[DEFAULT_MODEL_CONFIGS.WEBLLM.model]
    );
    expect(DEFAULT_WEBLLM_MODEL_INFO.size).toMatch(/MB|GB/);
  });

  it('keeps the default small enough to be a reasonable first download', () => {
    const [, value, unit] = DEFAULT_WEBLLM_MODEL_INFO.size.match(/^([\d.]+)\s?(MB|GB)$/i);
    const mb = unit.toUpperCase() === 'GB' ? parseFloat(value) * 1024 : parseFloat(value);
    expect(mb).toBeLessThan(600);
  });
});

describe('google model catalog', () => {
  it('lists the same ids the config declares', () => {
    expect(GOOGLE_MODEL_LIST.map((m) => m.id)).toEqual(
      Object.keys(LLM_CONFIG.EXTERNAL.GOOGLE.MODELS)
    );
  });

  it('defaults to a model in the catalog', () => {
    expect(LLM_CONFIG.EXTERNAL.GOOGLE.MODELS[DEFAULT_MODEL_CONFIGS.EXTERNAL.model]).toBeDefined();
  });

  it('offers only ids a live account reported having quota for', () => {
    // Read from retrieveUserQuota's buckets against a real account, not from a
    // changelog. gemini-3.5-flash was in this list once and 404s.
    const CONFIRMED = new Set([
      'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro',
      'gemini-3-flash-preview', 'gemini-3-pro-preview',
      'gemini-3.1-flash-lite', 'gemini-3.1-flash-lite-preview', 'gemini-3.1-pro-preview',
    ]);
    for (const m of CODE_ASSIST_MODEL_LIST) expect(CONFIRMED.has(m.id), m.id).toBe(true);
  });

  it('recommends exactly one model, and names every one', () => {
    expect(GOOGLE_MODEL_LIST.filter((m) => m.recommended)).toHaveLength(1);
    for (const m of GOOGLE_MODEL_LIST) {
      expect(m.name, m.id).toBeTruthy();
      expect(m.description, m.id).toBeTruthy();
    }
  });

  it('sends generation settings in the field @google/genai reads', () => {
    // The SDK takes `config`; the older `generationConfig` is ignored.
    expect(LLM_CONFIG.EXTERNAL.GOOGLE.DEFAULT_CONFIG).toMatchObject({
      temperature: expect.any(Number),
      maxOutputTokens: expect.any(Number),
    });
  });
});

// A config saved against an older catalog outlives the catalog. Google retires
// model ids, and generateContent then answers 404 with an empty body - no error
// text reaches the UI, so the app just appears to do nothing.
describe('migrateModelConfig', () => {
  it('rewrites a retired google model id to the recommended one', () => {
    const migrated = migrateModelConfig({
      type: 'external', provider: 'google', model: 'gemini-2.0-flash', apiKey: 'k',
    });
    expect(migrated.model).toBe(RECOMMENDED_GOOGLE_MODEL);
    expect(migrated.apiKey).toBe('k');
  });

  it('leaves a current google model id alone, and returns it unchanged', () => {
    const config = { type: 'external', provider: 'google', model: RECOMMENDED_GOOGLE_MODEL };
    expect(migrateModelConfig(config)).toBe(config);
  });

  it('recommends a model that is actually in the catalog', () => {
    expect(LLM_CONFIG.EXTERNAL.GOOGLE.MODELS[RECOMMENDED_GOOGLE_MODEL]).toBeDefined();
  });

  it('does not touch other backends, whose model ids are not google ids', () => {
    for (const config of [
      { type: 'demo' },
      { type: 'local', model: 'gemma3:4b' },
      { type: 'webllm', model: 'onnx-community/gemma-3-270m-it-ONNX' },
    ]) {
      expect(migrateModelConfig(config)).toBe(config);
    }
  });

  it('survives a malformed saved blob', () => {
    expect(migrateModelConfig(null)).toBe(null);
    expect(migrateModelConfig({})).toEqual({});
  });
});

// Code Assist and the Gemini Developer API do not share a model vocabulary.
// Sending a Developer-API id to Code Assist returns "Requested entity was not
// found", which names neither the entity nor the field at fault.
describe('code assist model catalog', () => {
  it('defaults to a model Code Assist actually offers', () => {
    expect(CODE_ASSIST_MODELS[DEFAULT_CODE_ASSIST_MODEL]).toBeDefined();
  });

  it('does not default to a Developer-API-only id', () => {
    // gemini-3.5-flash-lite is the Developer API default and does not exist on
    // Code Assist; using it here is exactly the bug this guards.
    expect(LLM_CONFIG.EXTERNAL.GOOGLE.MODELS[DEFAULT_CODE_ASSIST_MODEL]).toBeUndefined();
  });

  it('recommends exactly one model, and names every one', () => {
    expect(CODE_ASSIST_MODEL_LIST.filter((m) => m.recommended)).toHaveLength(1);
    for (const m of CODE_ASSIST_MODEL_LIST) {
      expect(m.name, m.id).toBeTruthy();
      expect(m.description, m.id).toBeTruthy();
    }
  });

  it('keeps a code-assist id the catalog does not list', () => {
    // The catalog is a seed; discovery routinely returns ids it never names,
    // and rewriting those would replace a working model the user chose with a
    // default - silently, which is worse than any error.
    const discovered = { type: 'code-assist', provider: 'google', model: 'gemini-9-unlisted' };
    expect(migrateModelConfig(discovered)).toBe(discovered);
  });

  it('leaves code-assist configs untouched when migrating', () => {
    // The migration rewrites unknown *Developer API* ids. A Code Assist id is
    // unknown to that catalog by design and must not be rewritten into one.
    const config = { type: 'code-assist', provider: 'google', model: DEFAULT_CODE_ASSIST_MODEL };
    expect(migrateModelConfig(config)).toBe(config);
  });
});

describe('migrating between the two Google clients', () => {
  it('leaves an Antigravity model alone', () => {
    // Migrated against the gemini-cli catalog it would be rewritten to a
    // gemini-cli id and sent to Antigravity, which does not know it.
    const config = { type: 'code-assist', authProvider: 'antigravity', model: 'gemini-3-flash' };
    expect(migrateModelConfig(config)).toBe(config);
  });

  it('rewrites an id carried over from the other client', () => {
    // gemini-2.5-pro is a gemini-cli id. Under Antigravity it cannot have been
    // chosen, only carried across, and it fails every request.
    const config = { type: 'code-assist', authProvider: 'antigravity', model: 'gemini-2.5-pro' };
    expect(migrateModelConfig(config).model).toBe(DEFAULT_ANTIGRAVITY_MODEL);
  });

  it('still rewrites a gemini-cli config to a gemini-cli default', () => {
    const config = { type: 'code-assist', model: 'gemini-3-flash' };
    expect(migrateModelConfig(config).model).toBe(DEFAULT_CODE_ASSIST_MODEL);
  });
});

describe('catalogs that overlap', () => {
  it('keeps a model both surfaces serve', () => {
    // gemini-3.1-flash-lite is in both catalogs. Treating "present in the other
    // one" as proof of crossing over rewrote it out of a working config.
    const shared = 'gemini-3.1-flash-lite';
    expect(CODE_ASSIST_MODELS[shared]).toBeDefined();
    expect(ANTIGRAVITY_MODELS[shared]).toBeDefined();

    for (const authProvider of ['gemini-cli', 'antigravity']) {
      const config = { type: 'code-assist', authProvider, model: shared };
      expect(migrateModelConfig(config), authProvider).toBe(config);
    }
  });
});
