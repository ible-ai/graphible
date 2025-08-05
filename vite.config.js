import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    nodePolyfills({
      // To make the polyfill work correctly, we need to include 'util'
      include: ['util'],
      // Optional: Other Node.js globals you might need, like 'process' or 'buffer'
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Optional: A shim for stream
      protocolImports: true,
    }),
  ],
});