import { test as base, expect } from '@playwright/test';
import { addCoverageReport } from 'monocart-reporter';

const test = base.extend({
  coverageConnectivity: [async ({ context }, use, testInfo) => {
    if (testInfo.project.name === 'coverage') {
      await context.addInitScript(() => {
        window.CifroConnectivity = {
          isServerAvailable: () => navigator.onLine,
          probe: async () => navigator.onLine,
          current: () => navigator.onLine ? 'servidor_disponivel' : 'servidor_indisponivel',
        };
      });
    }
    await use();
  }, { auto: true }],
  isolatedSession: [async ({ context }, use) => {
    await context.request.post('/api/testing/clone-session.php').catch(() => null);
    await use();
  }, { auto: true }],
  diagnostics: [async ({ page }, use, testInfo) => {
    const messages = [];
    page.on('console', message => messages.push(`[console:${message.type()}] ${message.text()}`));
    page.on('pageerror', error => messages.push(`[pageerror] ${error.stack || error.message}`));
    page.on('requestfailed', request => messages.push(`[requestfailed] ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
    await use();
    if (testInfo.status !== testInfo.expectedStatus && messages.length) {
      await testInfo.attach('browser.log', {
        body: Buffer.from(messages.join('\n'), 'utf8'),
        contentType: 'text/plain',
      });
    }
  }, { auto: true }],
  collectCoverage: [async ({ page }, use, testInfo) => {
    const enabled = process.env.JS_COVERAGE === '1' && testInfo.project.name !== 'setup';
    if (enabled) {
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
    }

    await use();

    if (enabled && !page.isClosed()) {
      const coverage = await page.coverage.stopJSCoverage();
      if (coverage.length) {
        await addCoverageReport(coverage, testInfo);
      }
    }
  }, { auto: true }],
});

export { test, expect };
