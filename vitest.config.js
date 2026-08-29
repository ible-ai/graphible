import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Kept separate from vite.config.js: that config forces HTTPS with certificates
// from .env/, which is gitignored, so importing it would make tests unrunnable
// on a fresh clone.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.{js,jsx}'],
    // Browser-model downloads and the Playwright suite live elsewhere.
    exclude: ['node_modules/**', 'e2e/**'],
  },
});
