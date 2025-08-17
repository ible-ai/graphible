// Graph configuration constants

export const WORLD_CENTER = { x: 0, y: 0 };
export const NODE_SIZE = { width: 280, height: 60 };
export const NODE_SPACING = { x: NODE_SIZE.width * 1.3, y: NODE_SIZE.height * 2.5 };
export const VIEWPORT_CENTER = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

export const colorSchemes = {
  blue: { 
    primary: '#3B82F6', 
    secondary: '#1E40AF', 
    accent: '#60A5FA', 
    bg: '#0F172A', 
    street: '#1E293B' 
  },
  purple: { 
    primary: '#8B5CF6', 
    secondary: '#7C3AED', 
    accent: '#A78BFA', 
    bg: '#1E1B4B', 
    street: '#312E81' 
  },
  green: { 
    primary: '#10B981', 
    secondary: '#059669', 
    accent: '#34D399', 
    bg: '#064E3B', 
    street: '#065F46' 
  },
  orange: { 
    primary: '#F59E0B', 
    secondary: '#D97706', 
    accent: '#FBBF24', 
    bg: '#92400E', 
    street: '#B45309' 
  }
};

export const ANIMATION_SETTINGS = {
  CAMERA_TRANSITION_DURATION: 300,
  KEYBOARD_THROTTLE_MS: 50,
  GENERATION_STATUS_UPDATE_MS: 1000
};

export const LLM_CONFIG = {
  BASE_URL: 'http://localhost:11434',
  MODEL: 'gemma3:4b',
  LW_MODEL: 'gemma3:270m',
  TAGS_ENDPOINT: '/api/tags',
  GENERATE_ENDPOINT: '/api/generate'
};