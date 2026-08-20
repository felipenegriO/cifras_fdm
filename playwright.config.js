import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

for (const file of ['.env.local', '.env']) {
  if (!fs.existsSync(file)) continue;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [name, ...parts] = line.split('=');
    if (process.env[name.trim()] !== undefined) continue;
    process.env[name.trim()] = parts.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const localDatabase = ['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || '');
if (localDatabase) {
  process.env.E2E_DB_NAME ||= 'cifro_e2e';
  process.env.TEST_EMAIL ||= 'admin@e2e.local';
  process.env.TEST_PASSWORD ||= 'CifroE2E#2026!';
}

if (!process.env.E2E_DB_NAME?.trim()) {
  throw new Error('E2E_DB_NAME é obrigatório e deve apontar para um banco exclusivo de testes.');
}
process.env.APP_ENV = 'test';

const ci = Boolean(process.env.CI);
const collectJsCoverage = process.env.JS_COVERAGE === '1';
const collectPhpCoverage = process.env.PHP_COVERAGE === '1';
const port = Number(process.env.CIFRO_E2E_PORT || (collectPhpCoverage ? 8091 : 8090));
const baseURL = `http://127.0.0.1:${port}`;
const rootPath = process.cwd().replace(/\\/g, '/');
const webServerEnv = { ...process.env };
for (const key of [
  'PAYMENT_PIX_PHONE', 'PAYMENT_PIX_RECIPIENT', 'PAYMENT_WHATSAPP_PHONE',
  'STRIPE_SECRET_KEY', 'STRIPE_LINK_MENSAL', 'STRIPE_LINK_SEMESTRAL', 'STRIPE_LINK_ANUAL',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI',
  // Os testes de webhook do Stripe assinam payloads com o segredo/preços de
  // teste fixos abaixo (fallback `|| 'whsec_playwright'` etc.). Sem este
  // delete, um STRIPE_WEBHOOK_SECRET/STRIPE_PRICE_* real no .env.local do
  // desenvolvedor (carregado em process.env logo acima) vence o fallback e
  // quebra a verificação de assinatura nos testes.
  'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_MENSAL', 'STRIPE_PRICE_SEMESTRAL', 'STRIPE_PRICE_ANUAL',
]) delete webServerEnv[key];
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_playwright';
process.env.STRIPE_PRICE_MENSAL = 'price_test_mensal';
process.env.STRIPE_PRICE_SEMESTRAL = 'price_test_semestral';
process.env.STRIPE_PRICE_ANUAL = 'price_test_anual';
const coverageOnlyTests = /(?:31-browser-branch-matrix|36-music-view-branches|37-rehearsal-audio-youtube-branches|38-offline-tools-branches|39-script-branches|40-php-under80-coverage|41-php-under80-endpoints|42-php-endpoint-residual-branches|43-js-residual-branches|44-js-ui-fallbacks|45-cifro-sync-validation|46-editor-residual-branches|47-live-residual-branches|48-rehearsal-audio-pitch-residual)\.spec\.js/;

const reporters = collectJsCoverage
  ? [
      ['list'],
      ['monocart-reporter', {
        name: 'Cobertura JavaScript E2E',
        outputFile: './playwright-report/coverage.html',
        coverage: {
          outputDir: './coverage/js',
          clean: false,
          cleanCache: false,
          reports: ['v8', 'v8-json', 'console-summary', 'json-summary', 'lcovonly'],
          sourcePath: filePath => {
            const normalized = filePath.replace(/\\/g, '/').replace(/[?#].*$/, '').replace(/-v=[^/]+$/, '');
            const sourceIndex = normalized.indexOf('src/js/');
            if (sourceIndex !== -1) return `public/${normalized.slice(sourceIndex)}`;
            if (normalized.includes('service-worker.js')) return 'public/service-worker.js';
            return normalized;
          },
          entryFilter: entry => {
            const url = entry.url.replace(/\\/g, '/');
            if (url.includes('/vendor/') || url.endsWith('.min.js') || url.includes('/06215d6691.js')) return false;
            return url.includes('/src/js/') || url.endsWith('/service-worker.js');
          },
          sourceFilter: sourcePath => !sourcePath.includes('/vendor/') && !sourcePath.endsWith('.min.js'),
          all: {
            dir: ['./public'],
            filter: {
              '**/vendor/**': false,
              '**/*.min.js': false,
              '**/06215d6691.js': false,
              '**/src/js/musicas.js': false,
              '**/src/js/playlists_salvas.js': false,
              '**/src/js/roteiros_salvos.js': false,
              '**/service-worker.js': true,
              '**/src/js/**/*.js': true,
              '**/*': false,
            },
          },
        },
      }],
    ]
  : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]];

export default defineConfig({
  testDir: './tests',
  globalTeardown: './tests/setup/global.teardown.js',
  timeout: 90000,
  expect: { timeout: 5000 },
  // Uma retentativa também localmente, não só no CI.
  //
  // O servidor de teste é `php -S`, single-thread (PHP 8.0 no Windows não tem
  // PHP_CLI_SERVER_WORKERS, que depende de fork). Sob a bateria inteira ele
  // engasga e derruba requisições — o sintoma no navegador é
  // `[cifroSync] sync failed: TypeError: Failed to fetch`, e a vítima muda a
  // cada execução. Com `retries: 1` isso aparece como "flaky", que é a
  // descrição honesta, em vez de "failed".
  //
  // CUIDADO: um bug intermitente do PRODUTO também vira "flaky" aqui. Por isso
  // o conjunto flaky conhecido está registrado em DEBT-003 no backlog.md — um
  // teste flaky que não esteja naquela lista é novidade e merece investigação,
  // não mais uma retentativa.
  retries: 1,
  workers: 1,
  reporter: reporters,

  use: {
    baseURL,
    viewport: { width: 1366, height: 768 },
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },

  projects: [
    {
      name: 'setup',
      testDir: './tests/setup',
      testMatch: /global\.setup\.js/,
    },
    {
      name: 'cifro',
      testDir: './tests/cifro',
      testIgnore: [
        /(?:26-offline-sync|30-service-worker-coverage|60-real-offline-user-flow|61-incremental-song-sync|62-playlist-persistence|63-critical-real-user-journeys|65-help-center-offline|66-offline-persistent-login)\.spec\.js/,
        /(?:32-rehearsal-real-flow|34-rehearsal-state|55-stripe-sandbox)\.spec\.js/,
        coverageOnlyTests,
      ],
      dependencies: ['setup'],
      use: {
        storageState: 'tests/.auth/user.json',
      },
    },
    {
      name: 'serial',
      testDir: './tests/cifro',
      testMatch: [/32-rehearsal-real-flow\.spec\.js/, /34-rehearsal-state\.spec\.js/, /55-stripe-sandbox\.spec\.js/],
      dependencies: ['setup'],
      use: {
        storageState: 'tests/.auth/user.json',
      },
    },
    {
      name: 'coverage',
      testDir: './tests/cifro',
      testMatch: coverageOnlyTests,
      dependencies: ['setup'],
      use: {
        storageState: 'tests/.auth/user.json',
      },
    },
    {
      name: 'visual',
      testDir: './tests',
      testMatch: [/\/music-layout\.spec\.js$/, /\/test-id165-scroll\.spec\.js$/],
      testIgnore: /\/music\/music-layout\.spec\.js$/,
      use: {
        storageState: 'tests/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'pwa',
      testDir: './tests/cifro',
      testMatch: /(?:26-offline-sync|30-service-worker-coverage|60-real-offline-user-flow|61-incremental-song-sync|62-playlist-persistence|63-critical-real-user-journeys|65-help-center-offline|66-offline-persistent-login)\.spec\.js/,
      timeout: 120000,
      dependencies: ['setup'],
      use: {
        storageState: 'tests/.auth/user.json',
        serviceWorkers: 'allow',
        video: 'off',
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'legacy',
      testDir: './tests',
      testMatch: [
        /\/(rehearsal-mode|rehearsal-audio-upload|e2e-rehearsal-complete-flow)\.spec\.js$/,
        /\/music\/music-layout\.spec\.js$/,
      ],
      use: {
        storageState: 'tests/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: `C:/xampp/php/php.exe -S 127.0.0.1:${port} -t public ${rootPath}/router.php`,
    env: {
      ...webServerEnv,
      APP_ENV: 'test',
      E2E_DB_NAME: process.env.E2E_DB_NAME,
      // Lê de webServerEnv (já sem essas 4 chaves), não de process.env: um
      // STRIPE_WEBHOOK_SECRET/STRIPE_PRICE_* real no .env.local do dev não
      // pode vencer o fallback de teste — só uma variável exportada de fato
      // no ambiente (CI, por exemplo) deveria sobrepor.
      STRIPE_WEBHOOK_SECRET: webServerEnv.STRIPE_WEBHOOK_SECRET || 'whsec_playwright',
      STRIPE_PRICE_MENSAL: webServerEnv.STRIPE_PRICE_MENSAL || 'price_test_mensal',
      STRIPE_PRICE_SEMESTRAL: webServerEnv.STRIPE_PRICE_SEMESTRAL || 'price_test_semestral',
      STRIPE_PRICE_ANUAL: webServerEnv.STRIPE_PRICE_ANUAL || 'price_test_anual',
      ...(collectPhpCoverage ? { XDEBUG_MODE: 'coverage', PHP_WEB_COVERAGE: '1' } : {}),
    },
    url: `${baseURL}/landing.php`,
    reuseExistingServer: false,
    timeout: 60000,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
