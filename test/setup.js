import '@testing-library/jest-dom/vitest';

// coordinateUtils reads window.innerWidth/innerHeight directly. jsdom defaults
// to 1024x768; pin it so coordinate assertions are stable regardless of the
// jsdom version's defaults.
Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
