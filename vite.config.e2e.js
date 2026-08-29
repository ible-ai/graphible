import { defineConfig } from 'vite';
import baseConfig from './vite.config.js';

// The main config serves over HTTPS using certificates in .env/, which is
// gitignored - so a fresh clone cannot start a server at all. Drop the server,
// preview and dev blocks entirely (mergeConfig keeps the base value when an
// override is undefined, so they have to be omitted rather than overridden)
// and preview over plain HTTP for the e2e suite.
// eslint-disable-next-line no-unused-vars
const { server, preview, dev, ...shared } = baseConfig;

export default defineConfig({
  ...shared,
  preview: { port: 4173, strictPort: true },
});
