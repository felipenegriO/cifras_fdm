/**
 * Gera public/og-image.png (1200x630) a partir de scripts/build/og-image.html.
 *
 * Uso: node scripts/build/generate-og-image.mjs
 *
 * Rode de novo sempre que a headline da landing mudar — o card compartilhado
 * no WhatsApp precisa dizer a mesma coisa que a página.
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const template = resolve(here, 'og-image.html');
const output = resolve(here, '../../public/og-image.png');

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});

await page.goto('file://' + template.replace(/\\/g, '/'));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: output });
await browser.close();

console.log('og-image.png gerado em ' + output);
