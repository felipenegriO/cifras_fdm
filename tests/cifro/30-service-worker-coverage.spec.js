import { test, expect } from '../fixtures/coverage.js';
import { chromium } from '@playwright/test';
import { addCoverageReport } from 'monocart-reporter';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
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

async function waitForDebugger(port, getSpawnError) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (getSpawnError()) {
      throw new Error(`Chromium de cobertura falhou ao iniciar: ${getSpawnError().message}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return response.json();
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Chromium de cobertura não iniciou.');
}

test('service worker executa instalação, cache, mensagens e recuperação offline reais', async ({ request }, testInfo) => {
  test.setTimeout(120000);
  test.skip(process.env.PHP_COVERAGE === '1', 'Cobertura JS do service worker; no PHP instrumentado passa de 1 minuto sem aumentar cobertura PHP relevante.');
  const appOrigin = process.env.PHP_COVERAGE === '1' ? 'http://127.0.0.1:8091' : 'http://127.0.0.1:8090';
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = await mkdtemp(path.join(tmpdir(), 'cifro-sw-'));
  const chrome = spawn(chromium.executablePath(), [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--disable-gpu',
  ], { stdio: 'ignore', windowsHide: true });
  // IMPORTANTE (root cause do crash de pipeline documentado na Iteracao 36/37
  // de .superpowers/sdd/coverage-100-log.md): `chrome` é um ChildProcess
  // (EventEmitter). Sem um listener para o evento 'error', uma falha do
  // subprocesso (ex.: ENOENT, EMFILE/ENOMEM sob contenção de recursos da
  // suite completa) lança uma exceção não capturada que derruba o processo
  // Node do Playwright inteiro (exit code 2, sem nenhum teste marcado como
  // falho, sem relatório de cobertura) - reproduzido de forma determinística
  // só sob a suite completa, nunca isolado, exatamente o padrão observado.
  // Capturamos aqui para converter em falha normal do teste em vez de crash
  // do processo.
  let spawnError = null;
  chrome.on('error', error => { spawnError = error; });
  let browser;
  let cdp;

  try {
    const version = await waitForDebugger(port, () => spawnError);
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
    const storage = await request.storageState();
    await context.addCookies(storage.cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      url: appOrigin + (cookie.path || '/'),
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    })));
    const page = await context.newPage();
    await page.goto(`${appOrigin}/index.php`);
    expect(await page.content()).toContain('CIFRO_USER_ID');
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
    await cdp.send('Runtime.evaluate', {
      expression: `new Promise((resolve, reject) => {
        const started = Date.now();
        const check = () => {
          if (!self.registration.installing) return resolve();
          if (Date.now() - started > 15000) return reject(new Error('Service worker não concluiu a instalação.'));
          setTimeout(check, 50);
        };
        check();
      })`,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    const helpers = await cdp.send('Runtime.evaluate', {
      expression: `(async () => {
        const appOrigin = ${JSON.stringify(appOrigin)};
        const checks = [
          validAsset(null),
          validAsset(Response.redirect(appOrigin + '/index.php')),
          validAsset(new Response('', { status: 200, headers: { 'content-type': 'text/css' } }), 'text/css'),
          validAsset(new Response('', { status: 200, headers: { 'content-type': 'application/octet-stream' } })),
          // expectedType fornecido mas o content-type real não bate (branch4 de validAsset, linha 26).
          validAsset(new Response('', { status: 200, headers: { 'content-type': 'text/css' } }), 'javascript'),
          // sem expectedType, mas content-type é text/html (ramo !type.includes('text/html') falso).
          validAsset(new Response('', { status: 200, headers: { 'content-type': 'text/html' } })),
          // resposta ok=false (status de erro) sem redirected - cobre o outro lado do optional chaining em response.ok.
          validAsset(new Response('', { status: 500 })),
          // validStagePage: resposta que não é validAsset (não-html) retorna false direto (linha 30, branch de curto-circuito).
          await validStagePage(new Response('', { status: 200, headers: { 'content-type': 'application/json' } })),
          // validStagePage: html valido mas sem marcador CIFRO_USER_ID nem loginForm - cai no false final.
          await validStagePage(new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } })),
          // pageKey com caracteres especiais no userId, força o encodeURIComponent (linha 48 implícita).
          typeof pageKey === 'function' ? pageKey('/index.php', { userId: 'a b&c', bandId: 'x y' }) : 'no-pageKey',
        ];
        await setContext('');
        checks.push(await getContext());
        // getContext com cache contendo JSON inválido (linha 44, catch branch).
        {
          const cache = await caches.open('cifro-meta');
          await cache.put('/__cifro_context__', new Response('não é json'));
          checks.push(await getContext());
        }
        // getContext com JSON válido mas sem a chave userId (linha 44, fallback null).
        {
          const cache = await caches.open('cifro-meta');
          await cache.put('/__cifro_context__', new Response(JSON.stringify({ outro: 1 }), { headers: { 'Content-Type': 'application/json' } }));
          checks.push(await getContext());
        }
        // populateStatic lança quando um asset estático vem com content-type
        // inesperado (linha 55, ramo verdadeiro do throw dentro do for).
        {
          const originalFetch = self.fetch;
          self.fetch = async () => new Response('', { status: 200, headers: { 'content-type': 'application/octet-stream' } });
          try {
            await populateStatic(await caches.open('cifro-static-3.4.0'));
            checks.push('no-throw-static');
          } catch (error) {
            checks.push(error.message);
          } finally {
            self.fetch = originalFetch;
          }
        }
        // preparePages lança quando a página buscada não passa em
        // validStagePage (linha 65, ramo verdadeiro do throw dentro do for,
        // distinto do guard de userId ausente já coberto abaixo).
        {
          const originalFetch = self.fetch;
          self.fetch = async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } });
          try {
            await preparePages('usuario-com-pagina-invalida', 'banda-com-pagina-invalida');
            checks.push('no-throw-pages');
          } catch (error) {
            checks.push(error.message);
          } finally {
            self.fetch = originalFetch;
          }
        }
        await setContext('');
        checks.push(await preparePages('', '').then(() => '', error => error.message));
        return checks;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    const helperChecks = helpers.result.value;
    expect(helperChecks.at(-1)).toBe('Usuário ou banda não identificados');
    // [4]=false (content-type não bate com expectedType), [5]=true (sem expectedType, html não é bloqueado por si só quando ok),
    // [6]=false (status 500 => ok false), [7]=false (validStagePage em JSON não-html), [8]=false (html sem marcador CIFRO_USER_ID).
    expect(helperChecks[4]).toBe(false);
    expect(helperChecks[6]).toBe(false);
    expect(helperChecks[7]).toBe(false);
    expect(helperChecks[8]).toBe(false);
    expect(helperChecks[9]).toBe('/index.php');
    // Índices [13] e [14]: throws de populateStatic/preparePages para asset e
    // página inválidos (linhas 55 e 65) - após os 3 checks de getContext
    // ([10]-[12]), antes do check final de preparePages('') que segue sendo
    // o último elemento (at(-1) acima).
    expect(helperChecks[13]).toContain('Asset inválido:');
    expect(helperChecks[14]).toContain('Página inválida:');

    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      let worker = registration?.active || registration?.waiting || registration?.installing;
      if (!worker) throw new Error('Service worker não registrado.');
      if (worker.state === 'installing') {
        await Promise.race([
          new Promise(resolve => worker.addEventListener('statechange', () => {
            if (worker.state !== 'installing') resolve();
          })),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker não concluiu a instalação.')), 10000)),
        ]);
      }
      worker = registration.active || registration.waiting || worker;
      if (worker.state === 'redundant') throw new Error('Instalação do service worker falhou.');
      if (worker.state !== 'activated') {
        worker.postMessage({ type: 'SKIP_WAITING' });
        await Promise.race([
          new Promise(resolve => worker.addEventListener('statechange', () => {
            if (worker.state === 'activated' || worker.state === 'redundant') resolve();
          })),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker não ativou.')), 10000)),
        ]);
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
      worker.postMessage({ type: 'SET_CONTEXT', userId: 'playwright-sw', bandId: 'band-sw' });
      await new Promise(resolve => setTimeout(resolve, 100));
      const prepared = await new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = event => {
          if (event.data?.state === 'completed' || event.data?.state === 'failed') resolve(event.data);
        };
        worker.postMessage({ type: 'PREPARE_OFFLINE', userId: 'playwright-sw', bandId: 'band-sw', songIds: [] }, [channel.port2]);
      });
      if (!prepared.ok) throw new Error(prepared.error);
      const rejected = await new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = event => {
          if (event.data?.state === 'completed' || event.data?.state === 'failed') resolve(event.data);
        };
        worker.postMessage({ type: 'PREPARE_OFFLINE', userId: '', bandId: '', songIds: [] }, [channel.port2]);
      });
      if (rejected.ok) throw new Error('Preparação sem usuário deveria falhar.');
      await fetch('/music.php?id=0');
      await fetch('/api/sync/version.php');
      await fetch('/src/backend/topnav.php');
      await fetch('/arquivo-inexistente.txt');
      await fetch('/index.php', { method: 'POST', body: 'x' });
      await fetch(appOrigin.replace('127.0.0.1', 'localhost') + '/index.php', { mode: 'no-cors' }).catch(() => null);
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
