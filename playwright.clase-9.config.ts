import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/clase-9',
  outputDir: 'test-results/clase-9',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: 1,
  workers: 2,
  fullyParallel: true,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/clase-9', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4179',
    actionTimeout: 5_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
