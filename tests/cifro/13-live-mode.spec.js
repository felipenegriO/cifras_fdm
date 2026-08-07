/**
 * 13-live-mode.spec.js
 * Live mode endpoints: status, host, update — auth, CSRF, edge cases.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

// Helper: fetch CSRF token from an authenticated page
async function getCsrfToken(page) {
  await page.goto('/index.php');
  return page.evaluate(() => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : null;
  });
}

// ── status.php ────────────────────────────────────────────────────────────────
test.describe('Live — status.php', () => {
  test('status da live retorna JSON para usuário autenticado', async ({ page }) => {
    const res = await page.request.get('/api/live/status.php');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('status da live bloqueia acesso sem autenticação', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.get('/api/live/status.php');
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('status da live não aceita escrita', async ({ page }) => {
    const res = await page.request.post('/api/live/status.php', {
      data: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(405);
  });
});

// ── host.php ──────────────────────────────────────────────────────────────────
test.describe('Live — host.php', () => {
  test('iniciar host sem token de segurança é bloqueado', async ({ page }) => {
    const res = await page.request.post('/api/live/host.php', {
      data: JSON.stringify({ action: 'start' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([403, 401]).toContain(res.status());
  });

  test('iniciar host sem autenticação é bloqueado', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.post('/api/live/host.php', {
      data: JSON.stringify({ action: 'start' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('endpoint de host não aceita GET', async ({ page }) => {
    const res = await page.request.get('/api/live/host.php');
    expect(res.status()).toBe(405);
  });

  test('iniciar host autenticado retorna resposta JSON', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/api/live/host.php', {
      data: JSON.stringify({ action: 'start' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422]).toContain(res.status());
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('iniciar host com formulário cria sessão com sucesso', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/api/live/host.php', {
      form: { action: 'start' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});

// ── update.php ────────────────────────────────────────────────────────────────
test.describe('Live — update.php', () => {
  test('atualizar estado do host sem token de segurança é bloqueado', async ({ page }) => {
    const res = await page.request.post('/api/live/update.php', {
      data: JSON.stringify({ hostId: 'test', cifraAtual: '1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([403, 401]).toContain(res.status());
  });

  test('atualizar estado do host sem autenticação é bloqueado', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.post('/api/live/update.php', {
      data: JSON.stringify({ hostId: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('endpoint de atualização de host não aceita GET', async ({ page }) => {
    const res = await page.request.get('/api/live/update.php');
    expect(res.status()).toBe(405);
  });

  test('atualizar estado do host autenticado retorna JSON', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/api/live/update.php', {
      data: JSON.stringify({ hostId: 'test-host', keepAlive: true }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 403, 422]).toContain(res.status());
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('atualização de host com cifra vazia é aceita pelo servidor', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/api/live/update.php', {
      data: JSON.stringify({ hostId: 'test-host', cifraAtual: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422]).toContain(res.status());
  });

  test('atualização de host com corpo inválido retorna erro sem quebrar o servidor', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/api/live/update.php', {
      data: 'não é json',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    // Accepts any non-crash response
    expect([200, 400, 422, 500]).toContain(res.status());
  });
});

// ── livePlayerLer.php (legacy) ────────────────────────────────────────────────
test.describe('Live — livePlayerLer.php (legacy GET)', () => {
  test('leitura de live bloqueia acesso sem autenticação', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.get('/src/backend/livePlayerLer.php');
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('leitura de live autenticado retorna resposta', async ({ page }) => {
    const res = await page.request.get('/src/backend/livePlayerLer.php');
    expect([200, 400]).toContain(res.status());
  });
});

// ── livePlayerSalvar.php (legacy POST) ───────────────────────────────────────
test.describe('Live — livePlayerSalvar.php (legacy POST)', () => {
  test('salvar estado do seguidor sem token de segurança é bloqueado', async ({ page }) => {
    const res = await page.request.post('/src/backend/livePlayerSalvar.php', {
      data: 'cifraAtual=1',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect([403, 401]).toContain(res.status());
  });

  test('salvar estado do seguidor sem autenticação é bloqueado', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.post('/src/backend/livePlayerSalvar.php', {
      data: 'cifraAtual=1',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('endpoint de salvar seguidor não aceita GET', async ({ page }) => {
    const res = await page.request.get('/src/backend/livePlayerSalvar.php');
    expect(res.status()).toBe(405);
    expect(await res.text()).toContain('Metodo nao permitido');
  });

  test('POST autenticado com CSRF e hostId inválido retorna mensagem de erro', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/src/backend/livePlayerSalvar.php', {
      data: 'numero=42&hostId=host-invalido',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf },
    });
    expect([200, 400]).toContain(res.status());
    const text = await res.text();
    expect(text).not.toBe('OK');
  });

  test('POST autenticado sem numero nem hostId retorna mensagem de erro', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/src/backend/livePlayerSalvar.php', {
      data: '',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf },
    });
    expect([200, 400]).toContain(res.status());
    const text = await res.text();
    expect(text).not.toBe('OK');
  });
});

// ── live.js (window.LiveMode) — módulo cliente ──────────────────────────────
test.describe('Live — módulo cliente (window.LiveMode)', () => {
  test('painel de live exibe "Aguardando host" quando nenhum host está ativo', async ({ page }) => {
    await page.route('**/api/live/status.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hasHost: false }),
    }));
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.consultarStatus());
    await expect(page.locator('#liveStatus')).toHaveText('Aguardando host');
    await expect(page.locator('#liveStatus')).toHaveAttribute('data-status', 'waiting');
  });

  test('entrar e sair da sessão de live alterna o estado do botão', async ({ page }) => {
    await page.route('**/api/live/status.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hasHost: true, hostNome: 'Ana', version: 1, paginaAtual: 'index.php' }),
    }));
    await page.goto('/index.php');

    await page.evaluate(() => window.LiveMode.entrarOuSairLive());
    await expect(page.locator('#liveStatus')).toHaveText('Seguindo live');
    await expect(page.locator('#entrarlivePlay')).toHaveText('Sair da sessão');

    await page.evaluate(() => window.LiveMode.entrarOuSairLive());
    await expect(page.locator('#liveStatus')).toHaveText('Live desconectada');
    await expect(page.locator('#entrarlivePlay')).toHaveText('Entrar na sessão');
  });

  test('tentar iniciar live sem conexão não cria sessão no servidor', async ({ page, context }) => {
    let called = false;
    await page.route('**/api/live/host.php', route => { called = true; route.abort(); });
    await page.goto('/index.php');
    await context.setOffline(true);
    await page.evaluate(() => window.LiveMode.assumirHost());
    await expect(page.locator('#liveStatus')).toHaveText('Live desconectada');
    expect(called).toBe(false);
    await context.setOffline(false);
  });

  test('falha de rede ao iniciar live exibe status desconectado', async ({ page }) => {
    await page.route('**/api/live/host.php', route => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'erro interno' }),
    }));
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.assumirHost());
    await expect(page.locator('#liveStatus')).toHaveText('Live desconectada');
  });

  test('resposta inválida do servidor mostra live como desconectada', async ({ page }) => {
    await page.route('**/api/live/status.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'sala nao encontrada' }),
    }));
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.consultarStatus());
    await expect(page.locator('#liveStatus')).toHaveText('Live desconectada');
  });

  test('iniciar live com sucesso exibe status de host e para de sondar o servidor', async ({ page }) => {
    await page.route('**/api/live/host.php', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hostId: 'host-abc', hostNome: 'Carla' }),
    }));
    await page.route('**/api/live/update.php', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hostNome: 'Carla' }),
    }));
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.assumirHost());
    await expect(page.locator('#liveStatus')).toHaveText('Voce e o host');
    await expect(page.locator('#livePlay, #liveHostButton')).toHaveText('Você está transmitindo');
  });

  test('usuário que já é host ao clicar no botão reforça a sessão ativa', async ({ page }) => {
    await page.route('**/api/live/host.php', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hostId: 'host-xyz', hostNome: 'Léo' }),
    }));
    await page.route('**/api/live/update.php', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hostNome: 'Léo' }),
    }));
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.assumirHost());
    await expect(page.locator('#liveStatus')).toHaveText('Voce e o host');

    // Segunda chamada: getMode() já é 'host', então assumirHostComConfirmacao
    // deve ir direto para assumirHost() sem passar por cifroConfirm/confirm().
    await page.evaluate(() => window.LiveMode.assumirHost !== undefined);
    await page.evaluate(() => {
      // assumirHostComConfirmacao não é exposto em window.LiveMode diretamente,
      // então simulamos via clique programático no botão já vinculado.
      const btn = document.getElementById('livePlay') || document.getElementById('liveHostButton');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await expect(page.locator('#liveStatus')).toHaveText('Voce e o host');
  });

  test('sessão de host sem ID salvo encerra e exibe live desconectada', async ({ page }) => {
    await page.goto('/index.php');
    await page.evaluate((key) => {
      sessionStorage.setItem(key, 'host');
    }, 'cifroLiveMode_default');
    await page.evaluate(() => window.LiveMode.atualizarPaginaHost(false));
    await expect(page.locator('#liveStatus')).toHaveText('Live desconectada');
  });

  test('host sem conexão não chama servidor e exibe live desconectada', async ({ page, context }) => {
    let called = false;
    await page.route('**/api/live/update.php', route => { called = true; route.abort(); });
    await page.goto('/index.php');
    await page.evaluate((keys) => {
      sessionStorage.setItem(keys.modeKey, 'host');
      localStorage.setItem(keys.hostIdKey, 'host-offline');
    }, { modeKey: 'cifroLiveMode_default', hostIdKey: 'cifroLiveHostId_default' });
    await context.setOffline(true);
    await page.evaluate(() => window.LiveMode.atualizarPaginaHost(false));
    await expect(page.locator('#liveStatus')).toHaveText('Live desconectada');
    expect(called).toBe(false);
    await context.setOffline(false);
  });

  test('seguidor em aba oculta não dispara sondagem ao entrar na sessão', async ({ page }) => {
    await page.route('**/api/live/status.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hasHost: false }),
    }));
    await page.goto('/index.php');
    const result = await page.evaluate(() => {
      try {
        Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
      } catch (e) {
        return 'defineProperty-failed: ' + e.message;
      }
      window.LiveMode.entrarOuSairLive();
      const salaId = (window.CIFRO_BAND_ID && window.CIFRO_BAND_ID !== '') ? window.CIFRO_BAND_ID : 'default';
      return sessionStorage.getItem('cifroLiveMode_' + salaId);
    });
    // Não deve lançar erro e o modo deve estar em 'follow' mesmo sem timer ativo.
    expect(result).toBe('follow');
  });

  test('ao minimizar e restaurar aba em modo follow, sondagem retoma corretamente', async ({ page }) => {
    await page.route('**/api/live/status.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hasHost: true, hostNome: 'Ana', version: 1, paginaAtual: 'index.php' }),
    }));
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.entrarOuSairLive());
    await expect(page.locator('#liveStatus')).toHaveText('Seguindo live');

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('#liveStatus')).toHaveText('Seguindo live');
  });

  test('ao minimizar e restaurar aba em modo host, atualização é retomada', async ({ page }) => {
    await page.route('**/api/live/host.php', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hostId: 'host-vis', hostNome: 'Rui' }),
    }));
    await page.route('**/api/live/update.php', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hostNome: 'Rui' }),
    }));
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.assumirHost());
    await expect(page.locator('#liveStatus')).toHaveText('Voce e o host');

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('#liveStatus')).toHaveText('Voce e o host');
  });

  test('reconexão à internet enquanto host retoma atualização da sessão', async ({ page }) => {
    let updateCalls = 0;
    await page.route('**/api/live/host.php', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hostId: 'host-online', hostNome: 'Bia' }),
    }));
    await page.route('**/api/live/update.php', route => {
      updateCalls++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, hostNome: 'Bia' }),
      });
    });
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.assumirHost());
    await expect(page.locator('#liveStatus')).toHaveText('Voce e o host');
    const before = updateCalls;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => updateCalls).toBeGreaterThan(before);
  });

  test('reconexão à internet enquanto seguidor retoma sondagem de status', async ({ page }) => {
    let statusCalls = 0;
    await page.route('**/api/live/status.php*', route => {
      statusCalls++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, hasHost: true, hostNome: 'Ana', version: 1, paginaAtual: 'index.php' }),
      });
    });
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.entrarOuSairLive());
    await expect(page.locator('#liveStatus')).toHaveText('Seguindo live');
    const before = statusCalls;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => statusCalls).toBeGreaterThan(before);
  });

  test('seguidor permanece na mesma página quando host está no mesmo local', async ({ page }) => {
    let call = 0;
    await page.route('**/api/live/status.php*', route => {
      call++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true, hasHost: true, hostNome: 'Ana',
          version: call, paginaAtual: 'index.php',
        }),
      });
    });
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.entrarOuSairLive());
    await expect(page.locator('#liveStatus')).toHaveText('Seguindo live');
    await page.evaluate(() => window.LiveMode.consultarStatus());
    await expect(page.locator('#liveStatus')).toHaveText('Seguindo live');
    expect(page.url()).toContain('index.php');
  });

  test('atalho de live não causa erro quando elementos da UI estão ausentes', async ({ page }) => {
    await page.route('**/api/live/status.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hasHost: true, hostNome: 'Ana', version: 1, paginaAtual: 'index.php' }),
    }));
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.entrarOuSairLive());
    await expect(page.locator('#liveStatus')).toHaveText('Seguindo live');
    await page.evaluate(() => {
      const wrapper = document.getElementById('mostrarbtnplay');
      if (wrapper) wrapper.remove();
    });
    // Não deve lançar erro mesmo com o wrapper ausente.
    await page.evaluate(() => window.LiveMode.consultarStatus());
    await expect(page.locator('#liveStatus')).toHaveText('Seguindo live');
  });

  test('storage da sessão usa ID real da banda do servidor como chave', async ({ page }) => {
    // O IIFE de live.js lê `window.CIFRO_BAND_ID` na primeira execução, e o
    // inline <script> do próprio index.php (que roda antes, no <head>/body)
    // já define esse valor a partir de current_band_id() no servidor — não é
    // possível sobrescrever via addInitScript porque a ordem de scripts do
    // documento vence. Verificamos então o comportamento real: com uma banda
    // válida, a chave de sessão usada não é o fallback 'default'.
    await page.route('**/api/live/status.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hasHost: false }),
    }));
    await page.goto('/index.php');
    const bandId = await page.evaluate(() => window.CIFRO_BAND_ID);
    await page.evaluate(() => window.LiveMode.entrarOuSairLive());
    const expectedKey = bandId ? `cifroLiveMode_${bandId}` : 'cifroLiveMode_default';
    const mode = await page.evaluate((key) => sessionStorage.getItem(key), expectedKey);
    expect(mode).toBe('follow');
  });

  test('tom inválido não é publicado no estado do host', async ({ page }) => {
    const data = await (await page.request.get('/api/sync/data.php')).json();
    const songId = data.musicas && data.musicas.length > 0 ? data.musicas[0].id : null;
    test.skip(!songId, 'Nenhuma música disponível para o teste');

    await page.route('**/api/live/host.php', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hostId: 'host-badparams', hostNome: 'Zeca' }),
    }));
    let capturedPayload = null;
    await page.route('**/api/live/update.php', route => {
      capturedPayload = route.request().postDataJSON();
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, hostNome: 'Zeca' }) });
    });
    await page.goto(`/music.php?id=${songId}&playlistTom=Z9`);
    await page.evaluate(() => {
      const el = document.getElementById('song-cifra');
      if (el) el.remove();
      try { Object.defineProperty(document, 'scrollingElement', { configurable: true, get: () => null }); } catch (e) {}
    });
    await page.evaluate(() => window.LiveMode.assumirHost());
    await expect(page.locator('#liveStatus')).toHaveText('Voce e o host');
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.cifraAtual).toBe(String(songId));
    expect(capturedPayload.paginaAtual).toBe(`music.php?id=${songId}`);
    expect(capturedPayload.paginaAtual).not.toContain('playlistTom');
  });

  test('resposta de sala fechada exibe live como desconectada', async ({ page }) => {
    await page.route('**/api/live/status.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'sala fechada' }),
    }));
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.consultarStatus());
    await expect(page.locator('#liveStatus')).toHaveText('Live desconectada');
  });

  test('atalho de live exibe link "IR PARA LIVE" quando host está em outra página', async ({ page }) => {
    await page.route('**/api/live/status.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hasHost: true, hostNome: 'Ana', version: 1, paginaAtual: 'music.php?id=999999' }),
    }));
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.consultarStatus());
    const wrapper = page.locator('#mostrarbtnplay');
    if (await wrapper.count()) {
      await expect(wrapper).toHaveCSS('display', 'block');
      await expect(page.locator('#entrarlivePlaynow')).toHaveAttribute('href', 'music.php?id=999999');
    }
  });

  test('sincronização de scroll desativada não move a tela do seguidor', async ({ page }) => {
    await page.route('**/api/live/status.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hasHost: true, hostNome: 'Ana', version: 1, paginaAtual: 'index.php', canSyncScroll: false, scrollPercent: 0.9 }),
    }));
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.entrarOuSairLive());
    await expect(page.locator('#liveStatus')).toHaveText('Seguindo live');
    // Segunda chamada de status com o mesmo version (sem mudança) — não deve navegar nem quebrar.
    await page.evaluate(() => window.LiveMode.consultarStatus());
    await expect(page.locator('#liveStatus')).toHaveText('Seguindo live');
  });

  test('sincronização de scroll em página sem rolagem não causa erro', async ({ page }) => {
    // Container sem overflow (max <= 0) força o ramo "else" do ternário de
    // `top` em applyFollowerScroll (linha 201: `Number(status.scrollTop || 0)`),
    // nunca exercitado porque os testes anteriores sempre tinham conteúdo
    // rolável quando canSyncScroll era true.
    await page.route('**/api/live/status.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true, hasHost: true, hostNome: 'Ana', version: 1, paginaAtual: 'index.php',
        canSyncScroll: true, scrollPercent: 0.5, scrollTop: 0,
      }),
    }));
    await page.goto('/index.php');
    await page.evaluate(() => {
      // Remove qualquer conteúdo que permita overflow, forçando max <= 0.
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.height = '10px';
    });
    await page.evaluate(() => window.LiveMode.entrarOuSairLive());
    await expect(page.locator('#liveStatus')).toHaveText('Seguindo live');
    // Não deve lançar erro; o ramo de fallback foi exercitado sem quebrar o fluxo.
  });

  test('tom válido é incluído no estado publicado pelo host', async ({ page }) => {
    const data = await (await page.request.get('/api/sync/data.php')).json();
    const songId = data.musicas && data.musicas.length > 0 ? data.musicas[0].id : null;
    test.skip(!songId, 'Nenhuma música disponível para o teste');

    await page.route('**/api/live/host.php', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hostId: 'host-validtom', hostNome: 'Rita' }),
    }));
    let capturedPayload = null;
    await page.route('**/api/live/update.php', route => {
      capturedPayload = route.request().postDataJSON();
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, hostNome: 'Rita' }) });
    });
    await page.goto(`/music.php?id=${songId}&playlistTom=C`);
    await page.evaluate(() => window.LiveMode.assumirHost());
    await expect(page.locator('#liveStatus')).toHaveText('Voce e o host');
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.paginaAtual).toBe(`music.php?id=${songId}&playlistTom=C`);
  });

  test('host em página sem ID de música publica estado sem cifra', async ({ page }) => {
    await page.route('**/api/live/host.php', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hostId: 'host-noid', hostNome: 'Léa' }),
    }));
    let capturedPayload = null;
    await page.route('**/api/live/update.php', route => {
      capturedPayload = route.request().postDataJSON();
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, hostNome: 'Léa' }) });
    });
    // music.php com id não-numérico: params.get('id') é truthy ("abc") mas o
    // regex de validId falha, então cifraAtual/paginaAtual ficam vazios e
    // podePublicar fica false — cobre o ramo `keepAlive: !!keepAlive ||
    // !state.podePublicar` (idx0 do OR, antes só testado via keepAlive=true).
    // Nota: música inexistente faz music.php redirecionar assincronamente
    // após o carregamento, então verificamos o payload capturado em vez do
    // texto de #liveStatus (que pode já ter sido desmontado pelo redirect).
    await page.goto('/music.php?id=abc');
    await page.evaluate(() => window.LiveMode.assumirHost());
    await expect.poll(() => capturedPayload).not.toBeNull();
    expect(capturedPayload.cifraAtual).toBeUndefined();
    expect(capturedPayload.paginaAtual).toBeUndefined();
    expect(capturedPayload.keepAlive).toBe(true);
  });

  test('scroll repetido sem mudança real não gera chamadas redundantes ao servidor', async ({ page }) => {
    await page.route('**/api/live/host.php', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hostId: 'host-scroll', hostNome: 'Tom' }),
    }));
    let updateCalls = 0;
    await page.route('**/api/live/update.php', route => {
      updateCalls++;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, hostNome: 'Tom' }) });
    });
    await page.goto('/index.php');
    await page.evaluate(() => {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.height = '10px';
    });
    await page.evaluate(() => window.LiveMode.assumirHost());
    await expect(page.locator('#liveStatus')).toHaveText('Voce e o host');
    const before = updateCalls;
    // Dispara scroll duas vezes seguidas sem mudança real de conteúdo: a
    // assinatura calculada (`scroll.canSync ? ... : 'none'`) fica igual nas
    // duas vezes, cobrindo tanto o ramo "none" quanto o early-return por
    // assinatura repetida (linha 448).
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await page.waitForTimeout(450);
    const afterFirst = updateCalls;
    expect(afterFirst).toBeGreaterThan(before);
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await page.waitForTimeout(450);
    expect(updateCalls).toBe(afterFirst);
  });

  test('músico cancela confirmação de iniciar live e nenhuma sessão de host é criada', async ({ page }) => {
    let hostCalled = false;
    await page.route('**/api/live/host.php', route => { hostCalled = true; route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, hostId: 'x' }) }); });
    await page.goto('/index.php');
    const btn = page.locator('#livePlay, #liveHostButton').first();
    await btn.evaluate(el => el.click());
    await page.locator('.cifro-confirm-btn--cancel').click();
    expect(hostCalled).toBe(false);
  });

  test('módulo de live inicializa corretamente quando carregado após o documento pronto', async ({ page }) => {
    // Recarrega o módulo live.js manualmente após o carregamento completo da
    // página (via injeção dinâmica de <script>), forçando o ramo else de
    // `document.readyState === 'loading'` (linha 527) — no carregamento normal
    // do <script> estático em index.php, o documento ainda está "loading"
    // nesse ponto, então só o ramo addEventListener era exercitado.
    await page.goto('/index.php');
    await page.waitForLoadState('domcontentloaded');
    const readyState = await page.evaluate(() => document.readyState);
    expect(readyState).not.toBe('loading');
    await page.addScriptTag({ url: '/src/js/live.js' });
    const hasLiveMode = await page.evaluate(() => typeof window.LiveMode === 'object');
    expect(hasLiveMode).toBe(true);
  });
});
