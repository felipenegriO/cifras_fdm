import { test as base, expect } from './diagnostics.js';
import { addCoverageReport } from 'monocart-reporter';
import { fazerLogin } from '../helpers/auth.js';

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
  isolatedSession: [async ({ context, page }, use) => {
    const seeded = (await context.cookies()).some(cookie => cookie.name === 'PHPSESSID' || cookie.name === 'cifro_lembrar');
    const cloned = await context.request.post('/api/testing/clone-session.php', { maxRedirects: 0 })
      .then(async response => response.status() === 200 && (await response.json().catch(() => null))?.ok === true)
      .catch(() => false);
    if (seeded && !cloned) {
      await fazerLogin(page);
    }
    await use();
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
