import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end UI tests. By default they run inside Docker against an isolated stack
 * (see the "e2e" profile in docker-compose.yml), so the app's own data is never touched.
 * BASE_URL / API_URL can point them at any running instance instead.
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  // One worker: the tests share one database and some of them measure seat counts.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 860 },
    locale: 'bn-BD',
    timezoneId: 'Asia/Dhaka',
    // PW_CHANNEL=chrome runs the installed Google Chrome instead of the bundled Chromium.
    channel: process.env.PW_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
