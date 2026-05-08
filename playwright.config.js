import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  workers: 20,
  use: {
    baseURL: 'http://localhost:8090',
    viewport: { width: 1366, height: 768 }
  }
});
