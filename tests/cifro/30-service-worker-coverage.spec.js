import { test, expect } from '../fixtures/coverage.js';
import { chromium } from '@playwright/test';
import { addCoverageReport } from 'monocart-reporter';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

class CdpConnection {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error ? reject(new Error(message.error.message)) : resolve(message.result);
      }
      for (const listener of this.listeners) listener(message);
    };
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.onopen = resolve;
      this.socket.onerror = reject;
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function waitForDebugger(port) {
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return response.json();
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Chromium de cobertura não iniciou.');
}

test('service worker executa instalação, cache, mensagens e recuperação offline reais', async ({}, testInfo) => {
  test.skip(process.env.PHP_COVERAGE === '1', 'Cobertura JS do service worker; no PHP instrumentado passa de 1 minuto sem aumentar cobertura PHP relevante.');
  const appOrigin = process.env.PHP_COVERAGE === '1' ? 'http://localhost:8091' : 'http://localhost:8090';
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = await mkdtemp(path.join(tmpdir(), 'cifro-sw-'));
  const chrome = spawn(chromium.executablePath(), [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--disable-gpu',
  ], { stdio: 'ignore', windowsHide: true });
  let browser;
  let cdp;

  try {
    const version = await waitForDebugger(port);
    cdp = new CdpConnection(version.webSocketDebuggerUrl);
    await cdp.open();
    let serviceWorkerSession;
    const attached = new Promise(resolve => {
      cdp.listeners.add(message => {
        if (message.method === 'Target.attachedToTarget' && message.params.targetInfo.type === 'service_worker' && message.params.targetInfo.url.includes('coverage=1')) {
          serviceWorkerSession = message.params.sessionId;
          resolve(serviceWorkerSession);
        }
      });
    });
    await cdp.send('Target.setAutoAttach', {
      autoAttach: true,
      waitForDebuggerOnStart: true,
      flatten: true,
      filter: [{ type: 'service_worker', exclude: false }, { exclude: true }],
    });

    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0];
    const storage = JSON.parse(await readFile('tests/.auth/user.json', 'utf8'));
    await context.addCookies(storage.cookies);
    const page = await context.newPage();
    await page.goto(`${appOrigin}/index.php`);
    await page.evaluate(async appOrigin => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
      await caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))));
      await navigator.serviceWorker.register('/service-worker.js?coverage=1');
    });

    const sessionId = await Promise.race([
      attached,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker não foi anexado ao CDP.')), 10000)),
    ]);
    await cdp.send('Debugger.enable', {}, sessionId);
    await cdp.send('Profiler.enable', {}, sessionId);
    await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true }, sessionId);
    await cdp.send('Runtime.runIfWaitingForDebugger', {}, sessionId);
    const helpers = await cdp.send('Runtime.evaluate', {
      expression: `(async () => {
        const appOrigin = ${JSON.stringify(appOrigin)};
        const checks = [
          validAsset(null),
          validAsset(Response.redirect(appOrigin + '/index.php')),
          validAsset(new Response('', { status: 200, headers: { 'content-type': 'text/css' } }), 'text/css'),
          validAsset(new Response('', { status: 200, headers: { 'content-type': 'application/octet-stream' } })),
        ];
        await setContext('');
        checks.push(await getContext());
        checks.push(await preparePages('').then(() => '', error => error.message));
        return checks;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    expect(helpers.result.value.at(-1)).toBe('Usuário não identificado');

    await page.evaluate(async appOrigin => {
      const registration = await navigator.serviceWorker.ready;
      const worker = registration.active || registration.waiting || registration.installing;
      if (worker && worker.state !== 'activated') {
        await new Promise(resolve => worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') resolve();
        }));
      }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(async appOrigin => {
      await fetch('/src/css/theme.css');
      await fetch('/index.php');
      const registration = await navigator.serviceWorker.ready;
      const worker = navigator.serviceWorker.controller || registration.active || registration.waiting;
      worker.postMessage({ type: 'SKIP_WAITING' });
      worker.postMessage({ type: 'UNKNOWN' });
      worker.postMessage({ type: 'SET_CONTEXT', userId: 'playwright-sw' });
      await new Promise(resolve => setTimeout(resolve, 100));
      const prepared = await new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = event => resolve(event.data);
        worker.postMessage({ type: 'PREPARE_OFFLINE', userId: 'playwright-sw' }, [channel.port2]);
      });
      if (!prepared.ok) throw new Error(prepared.error);
      const rejected = await new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = event => resolve(event.data);
        worker.postMessage({ type: 'PREPARE_OFFLINE', userId: '' }, [channel.port2]);
      });
      if (rejected.ok) throw new Error('Preparação sem usuário deveria falhar.');
      await fetch('/music.php?id=0');
      await fetch('/api/sync/version.php');
      await fetch('/src/backend/topnav.php');
      await fetch('/arquivo-inexistente.txt');
      await fetch('/index.php', { method: 'POST', body: 'x' });
      await fetch(appOrigin.replace('localhost', '127.0.0.1') + '/index.php', { mode: 'no-cors' }).catch(() => null);
    }, appOrigin);
    await cdp.send('Network.enable', {}, sessionId);
    await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, sessionId);
    await context.setOffline(true);
    const offlineResponse = await page.goto(`${appOrigin}/index.php`, { waitUntil: 'domcontentloaded' });
    expect(offlineResponse).toBeTruthy();
    const fallbackStatus = await page.evaluate(async () => (await fetch('/outro-arquivo-inexistente.txt')).status);
    expect([404, 504]).toContain(fallbackStatus);
    await context.setOffline(false);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, sessionId);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const worker = navigator.serviceWorker.controller || registration.active;
      worker.postMessage({ type: 'CLEAR_CONTEXT' });
      await new Promise(resolve => setTimeout(resolve, 100));
      await fetch('/roteiro.php?id=0');
      const meta = await caches.open('cifro-meta');
      await meta.put('/__cifro_context__', new Response('inválido'));
      await fetch('/select-banda.php');
    });

    const precise = await cdp.send('Profiler.takePreciseCoverage', {}, sessionId);
    const entry = precise.result.find(item => item.url.includes('/service-worker.js'));
    expect(entry, JSON.stringify(precise.result.map(item => item.url))).toBeTruthy();
    const source = await cdp.send('Debugger.getScriptSource', { scriptId: entry.scriptId }, sessionId);
    if (process.env.JS_COVERAGE === '1') {
      await addCoverageReport([{ ...entry, url: entry.url.replace('?coverage=1', ''), source: source.scriptSource }], testInfo);
    }
  } finally {
    cdp?.close();
    await browser?.close().catch(() => {});
    chrome.kill();
    await new Promise(resolve => setTimeout(resolve, 250));
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
});
