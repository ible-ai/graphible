import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    nodePolyfills({
      // Minimal polyfills to avoid conflicts
      include: ['util', 'buffer'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  base: '/graphible/',
  server: {
    host: true,
    port: 3000,
    https: {
      key: './.env/localhost+2-key.pem',
      cert: './.env/localhost+2.pem'
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    // Fix crypto compatibility issues
    rollupOptions: {
      external: ['crypto']
    }
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Ensure crypto uses the Node.js version
      crypto: 'crypto'
    }
  },
  dev: {
    https: {
      key: './.env/localhost+2-key.pem',
      cert: './.env/localhost+2.pem'
    }
  },
  preview: {
    https: {
      key: './.env/localhost+2-key.pem',
      cert: './.env/localhost+2.pem'
    }
  }
});