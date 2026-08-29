import { describe, it, expect, vi, beforeEach } from 'vitest';

// Both providers are stubbed: the point is which one a model id routes to and
// what shape comes back, not the inference itself.
const mlcCreate = vi.fn();
const mlcReload = vi.fn(async () => {});
vi.mock('@mlc-ai/web-llm', () => ({
  MLCEngine: class {
    constructor(opts) {
      this.opts = opts;
      this.chat = { completions: { create: mlcCreate } };
    }
    reload = mlcReload;
  },
}));

const transformersPipeline = vi.fn();
vi.mock('@huggingface/transformers', () => ({
  pipeline: (...args) => transformersPipeline(...args),
  TextGenerationPipeline: class {},
  TextStreamer: class {
    constructor(tokenizer, opts) {
      this.tokenizer = tokenizer;
      this.opts = opts;
    }
  },
}));

const { BrowserLLMEngine } = await import('../src/hooks/useBrowserLLMEngine');
const { BROWSER_LLM_TO_PROVIDER, BROWSER_LLM_PROVIDERS, WEBLLM_STATE } = await import(
  '../src/constants/graphConstants'
);

const harness = () => ({ setWebllmLoadState: vi.fn(), setWebllmLoadingProgress: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  transformersPipeline.mockResolvedValue(
    Object.assign(vi.fn(), { tokenizer: { name: 'stub-tokenizer' } })
  );
});

describe('BrowserLLMEngine construction', () => {
  it('rejects a config naming a model the registry does not know', () => {
    expect(() => new BrowserLLMEngine({ config: { model: 'nope' }, ...harness() })).toThrow();
    expect(() => new BrowserLLMEngine({ config: null, ...harness() })).toThrow();
  });

  it('accepts every model the registry advertises', () => {
    for (const model of BROWSER_LLM_TO_PROVIDER.keys()) {
      expect(() => new BrowserLLMEngine({ config: { model }, ...harness() })).not.toThrow();
    }
  });

  it('routes an MLC model to web-llm and nothing else', () => {
    const model = [...BROWSER_LLM_TO_PROVIDER.entries()]
      .find(([, p]) => p === BROWSER_LLM_PROVIDERS.MLC_AI__WEB_LLM)?.[0];
    if (!model) return;

    const engine = new BrowserLLMEngine({ config: { model }, ...harness() });
    expect(engine.mlcEngine).not.toBeNull();
    expect(engine.transformersJsPipeline).toBeNull();
    expect(transformersPipeline).not.toHaveBeenCalled();
  });

  it('routes a Transformers.js model to a webgpu pipeline with the configured dtype', () => {
    const model = [...BROWSER_LLM_TO_PROVIDER.entries()]
      .find(([, p]) => p === BROWSER_LLM_PROVIDERS.TRANSFORMERS_JS)?.[0];

    const engine = new BrowserLLMEngine({ config: { model, dtype: 'q4f16' }, ...harness() });
    expect(engine.mlcEngine).toBeNull();
    expect(transformersPipeline).toHaveBeenCalledWith(
      'text-generation',
      model,
      expect.objectContaining({ device: 'webgpu', dtype: 'q4f16' })
    );
  });

  it('defaults dtype to fp16 when the config omits it', () => {
    const model = [...BROWSER_LLM_TO_PROVIDER.entries()]
      .find(([, p]) => p === BROWSER_LLM_PROVIDERS.TRANSFORMERS_JS)?.[0];

    new BrowserLLMEngine({ config: { model }, ...harness() });
    expect(transformersPipeline).toHaveBeenCalledWith(
      'text-generation',
      model,
      expect.objectContaining({ dtype: 'fp16' })
    );
  });

  it('keeps the model id for the reuse check in useLLMConnection', () => {
    const model = [...BROWSER_LLM_TO_PROVIDER.keys()][0];
    expect(new BrowserLLMEngine({ config: { model }, ...harness() }).modelId).toBe(model);
  });
});

describe('BrowserLLMEngine streaming', () => {
  const tjsModel = [...BROWSER_LLM_TO_PROVIDER.entries()]
    .find(([, p]) => p === BROWSER_LLM_PROVIDERS.TRANSFORMERS_JS)?.[0];

  it('refuses to stream before load()', async () => {
    const engine = new BrowserLLMEngine({ config: { model: tjsModel }, ...harness() });
    await expect(engine.stream('hello')).rejects.toThrow(/load model/i);
  });

  it('emits the shared {"response": ...} envelope other backends produce', async () => {
    const generated = ['Hel', 'lo'];
    transformersPipeline.mockResolvedValue(
      Object.assign(
        vi.fn(async (_messages, opts) => {
          for (const piece of generated) opts.streamer.opts.callback_function(piece);
        }),
        { tokenizer: { name: 'stub' } }
      )
    );

    const engine = new BrowserLLMEngine({ config: { model: tjsModel }, ...harness() });
    await engine.load();

    const reader = (await engine.stream('prompt')).getReader();
    const decoder = new TextDecoder();
    let text = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value).split('\n')) {
        if (line.trim()) text += JSON.parse(line).response;
      }
    }

    // useGraphState parses exactly this shape, whichever backend produced it.
    expect(text).toBe('Hello');
  });
});

describe('WEBLLM_STATE', () => {
  it('declares the states the progress tracker switches on', () => {
    expect(WEBLLM_STATE).toMatchObject({
      NULL: expect.any(String),
      DOWNLOADING: 'downloading',
      RELOADING: 'reloading',
      DONE: 'done',
    });
  });
});
