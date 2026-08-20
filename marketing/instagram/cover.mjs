import { chromium } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT = process.cwd();
const SAIDA = path.join(ROOT, 'marketing/instagram/out/capa-reel.png');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const erros = [];
p.on('requestfailed', r => erros.push(r.url().split('/').pop()));
await p.goto(pathToFileURL(path.join(ROOT, 'marketing/instagram/stage/cover.html')).href);
await p.evaluate(async () => {
  await Promise.all([600, 700, 800].map(w => document.fonts.load(`${w} 88px Inter`)));
  await document.fonts.ready;
});
await p.waitForTimeout(800);
const fora = await p.evaluate(() => [...document.querySelectorAll('#cover-title span, #cover-mark *')]
  .map(el => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = el.tagName === 'IMG' ? el.getBoundingClientRect() : range.getBoundingClientRect();
    return { c: el.className || el.tagName, r };
  })
  .filter(({ r }) => r.width > 0 && (r.right > 961 || r.left < 119 || r.top < 219 || r.bottom > 1501))
  .map(({ c, r }) => `${c} [t=${Math.round(r.top)} l=${Math.round(r.left)} r=${Math.round(r.right)} b=${Math.round(r.bottom)}]`));
console.log('recursos que falharam:', erros.length ? erros : 'nenhum');
console.log('fora da zona segura:', fora.length ? fora : 'nada');

// Sobreposicao entre manchete e assinatura: a checagem de zona segura sozinha
// nao pega isso — as duas podem estar dentro da faixa e ainda assim colidir.
const colisao = await p.evaluate(() => {
  const caixa = sel => document.querySelector(sel).getBoundingClientRect();
  const t = caixa('#cover-title'), m = caixa('#cover-mark');
  return t.bottom > m.top ? `titulo termina em ${Math.round(t.bottom)}, assinatura comeca em ${Math.round(m.top)}` : null;
});
console.log('colisao titulo/assinatura:', colisao || 'nenhuma');
if (fora.length || colisao) { await b.close(); process.exit(1); }
await p.screenshot({ path: SAIDA });
console.log('capa:', SAIDA);
await b.close();
