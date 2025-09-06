// Enhanced Graph configuration constants with external API support

export const WORLD_CENTER = { x: 0, y: 0 };
export const NODE_SIZE = { width: 280, height: 60 };
export const NODE_SPACING = { x: NODE_SIZE.width * 0.5, y: NODE_SIZE.height * 0.5 };
export const VIEWPORT_CENTER = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

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
    DEFAULT_MODEL: 'gemma3:4b',
    LIGHTWEIGHT_MODEL: 'gemma3:270m',
    TAGS_ENDPOINT: '/api/tags',
    GENERATE_ENDPOINT: '/api/generate'
  },

  // See https://mlc.ai/models.
  // TODO: expand beyond outdated pre-compiled models.
  WEBLLM: {
    'Llama-3.2-3B-Instruct-q4f16_1-MLC': {
      name: 'Llama 3.2 3B (4-bit)',
      description: 'Balanced performance and size',
      size: '2.2GB',
      performance: 'Medium',
      recommended: true
    }
  },

  // External API configurations
  EXTERNAL: {
    GOOGLE: {
      MODELS: {
        'gemini-2.5-flash-lite': {
          name: 'Gemini 2.5 Flash Lite',
          description: 'Fast and lightweight',
          maxTokens: 2048
        },
        'gemini-2.5-flash': {
          name: 'Gemini 2.5 Flash',
          description: 'Balanced performance',
          maxTokens: 8192
        },
        'gemini-2.5-pro': {
          name: 'Gemini 2.5 Pro',
          description: 'Maximum capability',
          maxTokens: 32768
        }
      },
      DEFAULT_CONFIG: {
        temperature: 0.7,
        maxOutputTokens: 2048,
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
  local: {
    type: 'local',
    address: LLM_CONFIG.LOCAL.DEFAULT_BASE_URL,
    model: LLM_CONFIG.LOCAL.DEFAULT_MODEL
  },
  external: {
    type: 'external',
    provider: 'google',
    model: 'gemini-2.5-flash-lite',
    apiKey: ''
  }
};

// API endpoints and configuration (kept for reference but using SDK now)
export const API_INFO = {
  google: {
    sdkPackage: '@google/genai',
    documentationUrl: 'https://github.com/google-gemini/generative-ai-js',
    supportedModels: ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro']
  }
};

// Error messages for different connection failures
export const ERROR_MESSAGES = {
  LOCAL_CONNECTION_FAILED: 'Cannot connect to local LLM server. Please ensure Ollama is running and accessible.',
  EXTERNAL_API_FAILED: 'Cannot connect to external API. Please check your API key and internet connection.',
  INVALID_API_KEY: 'Invalid API key. Please check your credentials.',
  MODEL_NOT_FOUND: 'The specified model is not available or accessible.',
  RATE_LIMIT_EXCEEDED: 'API rate limit exceeded. Please try again later.',
  NETWORK_ERROR: 'Network error occurred. Please check your connection.'
};