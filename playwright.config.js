import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],

  use: {
    baseURL: 'http://localhost:8090',
    viewport: { width: 1366, height: 768 },
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block', // Prevent service workers from running during tests
  },

  projects: [
    // 1. Setup: autenticação salva em estado
    {
      name: 'setup',
      testDir: './tests/setup',
      testMatch: /global\.setup\.js/,
    },
    // 2. Suite principal — usa estado autenticado
    {
      name: 'stagebox',
      testDir: './tests/stagebox',
      dependencies: ['setup'],
      use: {
        storageState: 'tests/.auth/user.json',
      },
    },
    // 3. Testes legados (rehearsal, music layout)
    {
      name: 'legacy',
      testDir: './tests',
      testMatch: /\/(rehearsal|music-layout|e2e-rehearsal|test-id165).*\.spec\.js$/,
      use: {
        storageState: 'tests/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'C:/xampp/php/php.exe -S localhost:8090 -t public router.php',
    url: 'http://localhost:8090/landing.php',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
