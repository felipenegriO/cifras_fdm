import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const auditEnabled = process.env.E2E_AUDIT_DIAGNOSTICS === '1';

const test = base.extend({
  diagnostics: [async ({ browser, context }, use, testInfo) => {
    const records = [];
    const attachedContexts = new WeakSet();
    const attachedPages = new WeakSet();

    const record = (type, message, details = {}) => {
      records.push({
        at: new Date().toISOString(),
        type,
        message,
        ...details,
      });
    };

    const attachPage = page => {
      if (attachedPages.has(page)) return;
      attachedPages.add(page);
      page.on('pageerror', error => record('pageerror', error.stack || error.message, { url: page.url() }));
    };

    const attachContext = target => {
      if (attachedContexts.has(target)) return;
      attachedContexts.add(target);
      target.pages().forEach(attachPage);
      target.on('page', attachPage);
      target.on('console', message => record(`console:${message.type()}`, message.text(), {
        location: message.location(),
      }));
      target.on('requestfailed', request => record('requestfailed', request.failure()?.errorText || 'unknown', {
        method: request.method(),
        url: request.url(),
      }));
      target.on('response', response => {
        if (response.status() >= 500) {
          record('http5xx', `${response.status()} ${response.statusText()}`, {
            method: response.request().method(),
            url: response.url(),
          });
        }
      });
    };

    attachContext(context);
    const originalNewContext = browser.newContext;
    browser.newContext = async function (...args) {
      const created = await originalNewContext.apply(this, args);
      attachContext(created);
      return created;
    };

    try {
      await use();
    } finally {
      browser.newContext = originalNewContext;
      if (records.length && testInfo.status !== testInfo.expectedStatus) {
        const text = records.map(item => `[${item.type}] ${item.message}${item.url ? ` ${item.method || ''} ${item.url}` : ''}`).join('\n');
        await testInfo.attach('browser.log', {
          body: Buffer.from(text, 'utf8'),
          contentType: 'text/plain',
        });
      }
      if (auditEnabled && records.length) {
        const output = process.env.E2E_AUDIT_OUTPUT
          ? path.resolve(process.env.E2E_AUDIT_OUTPUT)
          : path.join(testInfo.project.outputDir, 'browser-diagnostics.jsonl');
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.appendFileSync(output, `${JSON.stringify({
          project: testInfo.project.name,
          file: testInfo.file,
          title: testInfo.titlePath,
          status: testInfo.status,
          expectedStatus: testInfo.expectedStatus,
          records,
        })}\n`);
      }
    }
  }, { auto: true }],
});

export { test, expect };
