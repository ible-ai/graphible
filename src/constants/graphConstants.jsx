// Enhanced Graph configuration constants with external API support

export const WORLD_CENTER = { x: 0, y: 0 };
export const NODE_SIZE = { width: 280, height: 60 };
export const NODE_SPACING = { x: NODE_SIZE.width * 0.5, y: NODE_SIZE.height * 0.5 };

// Each successive group of nodes (i.e., depth => depth + 1) is projected in a different x and y
// directions. This constant defines a convention for 6 possible projection directions, which are
// successively applied to each node group. In turn, this means that each new dialog branch is
// visually distinct from the previous.
export const RAD_PER_DEPTH = Math.PI / 3;

export const colorSchemes = {
  default: {
    primary: 'rgb(100, 116, 139)', // slate-500
    secondary: 'rgb(71, 85, 105)', // slate-600
    accent: 'rgb(148, 163, 184)', // slate-400
    bg: 'rgb(248, 250, 252)', // slate-50
    surface: 'rgb(255, 255, 255)', // white
    text: 'rgb(51, 65, 85)', // slate-700
    textMuted: 'rgb(100, 116, 139)', // slate-500
    border: 'rgb(226, 232, 240)', // slate-200
    success: 'rgb(34, 197, 94)', // green-500
    warning: 'rgb(245, 158, 11)', // amber-500
    error: 'rgb(239, 68, 68)', // red-500
    info: 'rgb(99, 102, 241)', // indigo-500
    // Root node colors
    rootBg: 'rgba(99, 102, 241, 0.08)', // indigo with transparency
    rootBorder: 'rgb(99, 102, 241)', // indigo-500
    rootText: 'rgb(67, 56, 202)', // indigo-700
  },
  blue: {
    primary: 'rgb(59, 130, 246)', // blue-500
    secondary: 'rgb(37, 99, 235)', // blue-600
    accent: 'rgb(96, 165, 250)', // blue-400
    bg: 'rgb(239, 246, 255)', // blue-50
    surface: 'rgb(255, 255, 255)', // white
    text: 'rgb(30, 58, 138)', // blue-800
    textMuted: 'rgb(59, 130, 246)', // blue-500
    border: 'rgb(191, 219, 254)', // blue-200
    success: 'rgb(34, 197, 94)', // green-500
    warning: 'rgb(245, 158, 11)', // amber-500
    error: 'rgb(239, 68, 68)', // red-500
    info: 'rgb(59, 130, 246)', // blue-500
    rootBg: 'rgba(59, 130, 246, 0.08)',
    rootBorder: 'rgb(59, 130, 246)',
    rootText: 'rgb(30, 58, 138)',
  },
  purple: {
    primary: 'rgb(139, 92, 246)', // violet-500
    secondary: 'rgb(124, 58, 237)', // violet-600
    accent: 'rgb(167, 139, 250)', // violet-400
    bg: 'rgb(250, 250, 255)', // violet-50
    surface: 'rgb(255, 255, 255)', // white
    text: 'rgb(91, 33, 182)', // violet-800
    textMuted: 'rgb(139, 92, 246)', // violet-500
    border: 'rgb(221, 214, 254)', // violet-200
    success: 'rgb(34, 197, 94)', // green-500
    warning: 'rgb(245, 158, 11)', // amber-500
    error: 'rgb(239, 68, 68)', // red-500
    info: 'rgb(139, 92, 246)', // violet-500
    rootBg: 'rgba(139, 92, 246, 0.08)',
    rootBorder: 'rgb(139, 92, 246)',
    rootText: 'rgb(91, 33, 182)',
  },
  green: {
    primary: 'rgb(34, 197, 94)', // green-500
    secondary: 'rgb(22, 163, 74)', // green-600
    accent: 'rgb(74, 222, 128)', // green-400
    bg: 'rgb(240, 253, 244)', // green-50
    surface: 'rgb(255, 255, 255)', // white
    text: 'rgb(20, 83, 45)', // green-800
    textMuted: 'rgb(34, 197, 94)', // green-500
    border: 'rgb(187, 247, 208)', // green-200
    success: 'rgb(34, 197, 94)', // green-500
    warning: 'rgb(245, 158, 11)', // amber-500
    error: 'rgb(239, 68, 68)', // red-500
    info: 'rgb(34, 197, 94)', // green-500
    rootBg: 'rgba(34, 197, 94, 0.08)',
    rootBorder: 'rgb(34, 197, 94)',
    rootText: 'rgb(20, 83, 45)',
  },
  orange: {
    primary: 'rgb(249, 115, 22)', // orange-500
    secondary: 'rgb(234, 88, 12)', // orange-600
    accent: 'rgb(251, 146, 60)', // orange-400
    bg: 'rgb(255, 247, 237)', // orange-50
    surface: 'rgb(255, 255, 255)', // white
    text: 'rgb(154, 52, 18)', // orange-800
    textMuted: 'rgb(249, 115, 22)', // orange-500
    border: 'rgb(254, 215, 170)', // orange-200
    success: 'rgb(34, 197, 94)', // green-500
    warning: 'rgb(249, 115, 22)', // orange-500
    error: 'rgb(239, 68, 68)', // red-500
    info: 'rgb(249, 115, 22)', // orange-500
    rootBg: 'rgba(249, 115, 22, 0.08)',
    rootBorder: 'rgb(249, 115, 22)',
    rootText: 'rgb(154, 52, 18)',
  }
};

export const ANIMATION_SETTINGS = {
  CAMERA_TRANSITION_DURATION: 300,
  KEYBOARD_THROTTLE_MS: 50,
  GENERATION_STATUS_UPDATE_MS: 1000
};

// Enhanced LLM configuration supporting both local and external models
export const LLM_CONFIG = {
  // Local configuration (Ollama)
  LOCAL: {
    DEFAULT_BASE_URL: 'http://localhost:11434',
    // gemma3:4b (3.3GB) stays the default: gemma4's smallest variant is 7.2GB
    // and the line has no sub-1GB tier. gemma4:e4b is offered in the setup
    // guide for anyone who wants the newer, multimodal generation.
    DEFAULT_MODEL: 'gemma3:4b',
    LIGHTWEIGHT_MODEL: 'gemma3:270m',
    TAGS_ENDPOINT: '/api/tags',
    GENERATE_ENDPOINT: '/api/generate'
  },

  // See https://mlc.ai/models and
  // https://huggingface.co/models?pipeline_tag=text-generation&library=transformers.js
  // Browser models. `size` is the actual download at the listed dtype, summed
  // over the ONNX graph and its external .onnx_data weights - not the
  // parameter count. WebLLMProgressTracker parses it for its progress maths,
  // and the wizard quotes it for consent, so it has to be the real figure.
  WEBLLM: {
    "onnx-community/gemma-3-270m-it-ONNX": {
      name: 'Gemma 3 270M',
      params: '270M',
      size: '273 MB',
      dtype: 'q4f16',
      performance: 'Low',
      recommended: true
    },
    "onnx-community/Qwen3-0.6B-ONNX": {
      name: 'Qwen3 0.6B',
      params: '0.6B',
      size: '570 MB',
      dtype: 'q4f16',
      performance: 'Low-Medium',
      recommended: false
    },
    "onnx-community/gemma-3-1b-it-ONNX": {
      name: 'Gemma 3 1B',
      params: '1B',
      size: '764 MB',
      dtype: 'q4f16',
      performance: 'Medium',
      recommended: false
    },
    'gemma3-1b-it-q4f16_1-MLC': {
      name: 'Gemma 3 1B (MLC)',
      params: '1B',
      size: '711 MB',
      dtype: 'q4f16',
      performance: 'Medium',
      recommended: false
    }
  },

  // External API configurations.
  // Single source of truth for the Google model list: ModelSelector, the setup
  // wizard and the installation guide all derive from this.
  EXTERNAL: {
    GOOGLE: {
      MODELS: {
        'gemini-3.5-flash-lite': {
          name: 'Gemini 3.5 Flash Lite',
          description: 'Fastest and most cost-effective',
          recommended: true
        },
        'gemini-3.6-flash': {
          name: 'Gemini 3.6 Flash',
          description: 'Balanced speed and capability',
          recommended: false
        },
        'gemini-3.7-flash': {
          name: 'Gemini 3.7 Flash',
          description: 'Most capable, for complex reasoning',
          recommended: false
        }
      },
      DEFAULT_CONFIG: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        topK: 40,
        topP: 0.95
      }
    }
  },

  // Backwards compatibility
  BASE_URL: 'http://localhost:11434',
  MODEL: 'gemma3:4b',
  LW_MODEL: 'gemma3:270m',
  TAGS_ENDPOINT: '/api/tags',
  GENERATE_ENDPOINT: '/api/generate'
};

// Model configuration defaults
export const DEFAULT_MODEL_CONFIGS = {
  DEMO: {
    type: 'demo',
    name: 'Demo Mode',
    description: 'Try Graphible with sample content',
    model: "demo"
  },
  LOCAL: {
    type: 'local',
    address: LLM_CONFIG.LOCAL.DEFAULT_BASE_URL,
    model: LLM_CONFIG.LOCAL.DEFAULT_MODEL
  },
  EXTERNAL: {
    type: 'external',
    provider: 'google',
    model: 'gemini-3.5-flash-lite',
    apiKey: ''
  },
  WEBLLM: {
    type: 'webllm',
    model: 'onnx-community/gemma-3-270m-it-ONNX',
    dtype: 'q4f16'
  }
};

// Default to demo mode instead of WebLLM
export const DEFAULT_MODEL_CONFIG = DEFAULT_MODEL_CONFIGS.DEMO;

// API endpoints and configuration (kept for reference but using SDK now)
export const API_INFO = {
  google: {
    sdkPackage: '@google/genai',
    documentationUrl: 'https://github.com/google-gemini/generative-ai-js',
    supportedModels: Object.keys(LLM_CONFIG.EXTERNAL.GOOGLE.MODELS)
  }
};

// Error messages for different connection failures
export const ERROR_MESSAGES = {
  LOCAL_CONNECTION_FAILED: 'Cannot connect to local LLM server. Please ensure Ollama is running and accessible.',
  EXTERNAL_API_FAILED: 'Cannot connect to external API. Please check your API key and internet connection.',
  INVALID_API_KEY: 'Invalid API key. Please check your credentials.',
  MODEL_NOT_FOUND: 'The specified model is not available or accessible.',
  RATE_LIMIT_EXCEEDED: 'API rate limit exceeded. Please try again later.',
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  // Consent-related errors
  USER_DECLINED_DOWNLOAD: 'Model download was declined by user.',
  CONSENT_REQUIRED: 'User consent is required before downloading AI models.',
  MODEL_DOWNLOAD_BLOCKED: 'Model download blocked - consent not granted.'
};

// How a model's answer becomes nodes.
//
//   graph  - ask for several JSON node objects and lay each one out as its own
//            node, the original behaviour.
//   single - let the model answer normally and keep the whole reply in one
//            node. Branching and navigation then come from the graph rather
//            than from decomposing a single reply.
export const RESPONSE_MODES = {
  GRAPH: 'graph',
  SINGLE: 'single'
};

export const RESPONSE_MODE_LABELS = {
  [RESPONSE_MODES.GRAPH]: {
    name: 'Graph',
    description: 'Break the answer into connected nodes'
  },
  [RESPONSE_MODES.SINGLE]: {
    name: 'Single',
    description: 'Keep the whole answer in one node'
  }
};

export const DEFAULT_RESPONSE_MODE = RESPONSE_MODES.GRAPH;

// Graph mode asks for several strictly-formatted JSON objects. Models of this
// size do not reliably produce that, and the reply then falls back to a single
// node anyway - so single mode is both the honest default and the better
// experience for them.
export const RESPONSE_MODE_BY_BACKEND = {
  webllm: RESPONSE_MODES.SINGLE,
};

export const preferredResponseModeFor = (modelConfig) =>
  RESPONSE_MODE_BY_BACKEND[modelConfig?.type] ?? null;
export const RESPONSE_MODE_STORAGE_KEY = 'graphible-response-mode';

export const WEBLLM_STATE = {
  NULL: '',
  DOWNLOADING: 'downloading',
  RELOADING: 'reloading',
  DONE: 'done',
};

export const CONSENT_TYPES = {
  WEBLLM_DOWNLOAD: 'webllm-download',
  DATA_COLLECTION: 'data-collection',
  ANALYTICS: 'analytics'
};

export const CONSENT_STATUS = {
  NOT_REQUESTED: 'not-requested',
  PENDING: 'pending',
  GRANTED: 'granted',
  DENIED: 'denied',
  EXPIRED: 'expired'
};

export const BROWSER_LLM_PROVIDERS = {
  MLC_AI__WEB_LLM: "@mlc-ai/web-llm",
  TRANSFORMERS_JS: "@huggingface/transformers"
};

export const BROWSER_LLM_TO_PROVIDER = new Map([
  ['gemma3-1b-it-q4f16_1-MLC', BROWSER_LLM_PROVIDERS.MLC_AI__WEB_LLM],
  ['onnx-community/gemma-3-270m-it-ONNX', BROWSER_LLM_PROVIDERS.TRANSFORMERS_JS],
  ['onnx-community/Qwen3-0.6B-ONNX', BROWSER_LLM_PROVIDERS.TRANSFORMERS_JS],
  ['onnx-community/gemma-3-1b-it-ONNX', BROWSER_LLM_PROVIDERS.TRANSFORMERS_JS]
]);

// The browser model the setup wizard actually configures, for UI copy.
// Derived so download sizes and names cannot drift from LLM_CONFIG.WEBLLM.
export const DEFAULT_WEBLLM_MODEL_INFO =
  LLM_CONFIG.WEBLLM[DEFAULT_MODEL_CONFIGS.WEBLLM.model];

// Google models as an ordered array, for components that render a list.
export const GOOGLE_MODEL_LIST = Object.entries(LLM_CONFIG.EXTERNAL.GOOGLE.MODELS)
  .map(([id, info]) => ({ id, ...info }));

// Code Assist speaks a different model vocabulary from the Gemini Developer
// API - gemini-3.5-flash-lite exists on one and not the other, and sending the
// wrong name returns "Requested entity was not found" with nothing to say which
// entity. Ids are from gemini-cli's packages/core/src/config/models.ts
// (VALID_GEMINI_MODELS), which is the only published list of what this endpoint
// accepts.
//
// Being in that list is necessary but not sufficient. gemini-cli never sends a
// picked id straight through: resolveModel() rewrites it against per-account
// state fetched at startup - hasAccessToPreview, a gemini-3.1 launch flag, and
// a GEMINI_3_5_FLASH_GA_LAUNCHED experiment - and substitutes a GA model when
// the account lacks preview access. We send the id verbatim, so only ids that
// need no such access can be offered here. That is what ruled out
// gemini-3.1-pro-preview and gemini-3-pro-preview: valid strings, rejected for
// an account without preview access.
//
// gemini-3.7-flash is Developer-API-only and is not in this vocabulary at all.
export const CODE_ASSIST_MODELS = {
  'gemini-3.1-flash-lite': {
    name: 'Gemini 3.1 Flash Lite',
    description: 'Fastest, and the lightest use of your allowance',
    recommended: true,
  },
  'gemini-3.5-flash': {
    name: 'Gemini 3.5 Flash',
    description: 'Balanced speed and capability',
    recommended: false,
  },
  // gemini-cli's own DEFAULT_GEMINI_MODEL, and ungated - the 3.x Pro models are
  // all preview and need account access we cannot detect.
  'gemini-2.5-pro': {
    name: 'Gemini 2.5 Pro',
    description: 'Most capable, and the heaviest use of your allowance',
    recommended: false,
  },
};

// Antigravity reaches the same endpoint with its own OAuth client, and that
// client is served newer models. Wire ids are from opencode-antigravity-auth's
// model-resolver (the `antigravity-` prefix there is its own alias, stripped
// before the request) - a Pro model takes a -low/-high thinking suffix.
//
// Treat this as a seed, not an inventory: discovery replaces it with whatever
// the account's own quota buckets name, which is the only list that is true
// per account.
export const ANTIGRAVITY_MODELS = {
  'gemini-3-flash': {
    name: 'Gemini 3 Flash',
    description: 'Fastest, and the lightest use of your allowance',
    recommended: true,
  },
  'gemini-3.1-pro-low': {
    name: 'Gemini 3.1 Pro',
    description: 'Newest, with light reasoning',
    recommended: false,
  },
  'gemini-3.1-pro-high': {
    name: 'Gemini 3.1 Pro (high)',
    description: 'Newest, reasoning turned up - heaviest use of your allowance',
    recommended: false,
  },
};

export const ANTIGRAVITY_MODEL_LIST = Object.entries(ANTIGRAVITY_MODELS)
  .map(([id, info]) => ({ id, ...info }));

export const DEFAULT_ANTIGRAVITY_MODEL =
  (ANTIGRAVITY_MODEL_LIST.find((m) => m.recommended) ?? ANTIGRAVITY_MODEL_LIST[0]).id;

export const CODE_ASSIST_MODEL_LIST = Object.entries(CODE_ASSIST_MODELS)
  .map(([id, info]) => ({ id, ...info }));

// 'gemini-3.1-pro-preview' -> 'Gemini 3.1 Pro Preview'. Only used for ids the
// static catalog does not name, which is the point: a model Google adds
// tomorrow should appear without a release here.
export const titleForModelId = (id) =>
  id.split('-')
    .map((part) => (/^[0-9.]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');

// The menu, given what the account turned out to have. Ids the static catalog
// names keep their wording; anything else - a preview model this account has
// access to, or one Google adds later - is titled from its id rather than
// hidden. An empty list means discovery did not happen or failed, so the
// static catalog stands.
export const buildCodeAssistModelList = (discoveredIds, provider = 'gemini-cli') => {
  const known = provider === 'antigravity' ? ANTIGRAVITY_MODELS : CODE_ASSIST_MODELS;
  const fallback = provider === 'antigravity' ? ANTIGRAVITY_MODEL_LIST : CODE_ASSIST_MODEL_LIST;
  const preferredId = provider === 'antigravity' ? DEFAULT_ANTIGRAVITY_MODEL : DEFAULT_CODE_ASSIST_MODEL;

  if (!discoveredIds?.length) return fallback;

  const list = discoveredIds.map((id) => ({
    id,
    name: known[id]?.name ?? titleForModelId(id),
    description: known[id]?.description ?? '',
    recommended: false,
  }));

  // Keep a recommendation, so the panel still points somewhere on first open.
  const preferred = list.find((m) => m.id === preferredId)
    ?? list.find((m) => m.id.includes('flash-lite'))
    ?? list.find((m) => m.id.includes('flash'))
    ?? list[0];
  preferred.recommended = true;
  return list;
};

export const DEFAULT_CODE_ASSIST_MODEL =
  (CODE_ASSIST_MODEL_LIST.find((m) => m.recommended) ?? CODE_ASSIST_MODEL_LIST[0]).id;

// The recommended Google model, and the fallback for anything unrecognised.
export const RECOMMENDED_GOOGLE_MODEL =
  (GOOGLE_MODEL_LIST.find((m) => m.recommended) ?? GOOGLE_MODEL_LIST[0]).id;

// A model id persisted before the catalog moved on can name a model Google has
// since retired. The saved config is loaded verbatim, so the stale id survives
// upgrades and every request 404s - with an empty body, so nothing surfaces.
// Any id no longer in the catalog is rewritten to the recommended one.
// Each backend is migrated against its own catalog. Code Assist ids that leave
// the catalog are not necessarily retired at Google, so a saved one keeps
// working - but it is no longer offered in the menu, which leaves the user on a
// model they cannot see and cannot switch back to.
export const migrateModelConfig = (config) => {
  if (config?.type === 'code-assist') {
    // Each client has its own catalog. Migrating an Antigravity id against the
    // gemini-cli one rewrites a working model into a foreign id - the same
    // crossing-over this function exists to prevent.
    const antigravity = config.authProvider === 'antigravity';
    const catalog = antigravity ? ANTIGRAVITY_MODELS : CODE_ASSIST_MODELS;
    if (Object.hasOwn(catalog, config.model)) return config;
    return { ...config, model: antigravity ? DEFAULT_ANTIGRAVITY_MODEL : DEFAULT_CODE_ASSIST_MODEL };
  }
  if (config?.type !== 'external' || config?.provider !== 'google') return config;
  if (Object.hasOwn(LLM_CONFIG.EXTERNAL.GOOGLE.MODELS, config.model)) return config;
  return { ...config, model: RECOMMENDED_GOOGLE_MODEL };
};
