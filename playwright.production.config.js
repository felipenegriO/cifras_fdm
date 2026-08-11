import { defineConfig } from '@playwright/test';

const baseURL = `${process.env.PROD_BASE_URL || 'https://cifro.online/beta/public'}/`.replace(/\/{2,}$/, '/');

export default defineConfig({
  testDir: './tests/production',
  timeout: 120000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-production' }]],
  use: {
    baseURL,
    serviceWorkers: 'allow',
    ignoreHTTPSErrors: false,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
});
