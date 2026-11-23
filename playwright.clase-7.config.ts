import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/clase-7',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4177',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
