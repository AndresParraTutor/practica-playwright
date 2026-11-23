import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/clase-9',
  outputDir: 'test-results/clase-10',
  timeout: 30_000,
  globalTimeout: 5 * 60 * 1000,
  expect: { timeout: 5_000 },
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/clase-10', open: 'never' }],
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
  webServer: {
    command: 'node practica-clase-9/servidor.cjs defecto',
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: false,
    timeout: 15_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
