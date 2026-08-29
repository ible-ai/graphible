import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // WebGPU is off by default in headless Chromium. Enabling it lets the
        // browser-model capability check be exercised; tests that need an
        // adapter skip themselves when the machine cannot provide one.
        launchOptions: {
          args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan'],
        },
      },
    },
  ],

  // Builds and previews over plain HTTP; the default config's HTTPS needs
  // certificates that are not in the repo.
  webServer: {
    command: `npm run build && npx vite preview --config vite.config.e2e.js --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
