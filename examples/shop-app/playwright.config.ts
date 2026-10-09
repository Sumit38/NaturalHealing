import { defineConfig } from '@playwright/test';

const version = ['v2', 'v3'].includes(process.env.APP_VERSION ?? '') ? process.env.APP_VERSION! : 'v1';
const port = 4510;

export default defineConfig({
  testDir: './tests',
  outputDir: './.results/test-output',
  // One worker: the MVP fingerprint store is a single JSON file per run.
  workers: 1,
  timeout: 15_000,
  expect: { timeout: 2_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 3_000,
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] },
  },
  webServer: {
    command: `node --import tsx server.ts`,
    url: `http://127.0.0.1:${port}/login`,
    env: { APP_VERSION: version, PORT: String(port) },
    reuseExistingServer: false,
  },
});
