/**
 * 18-edge-cases.spec.js
 * Edge cases: XSS, SQL injection, boundary values, special chars, large payloads.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function getCsrf(page) {
  const res = await page.request.get('/api/csrf.php');
  const body = await res.json();
  return body.csrf_token || '';
}

const MUSIC_API = '/src/backend/editor/api.php';
const PLAYLIST_API = '/src/backend/editor/salvar_playlists.php';
const ROTEIRO_API = '/src/backend/editor/salvar_roteiros.php';

// ── XSS em campos de texto ────────────────────────────────────────────────────
test.describe('XSS — campos de criação não executam scripts', () => {
  test('nome de música com payload XSS é escapado na exibição', async ({ page }) => {
    const csrf = await getCsrf(page);
    const xssNome = '<script>window.__xss_musica=1</script>';
    const res = await page.request.post(MUSIC_API, {
      data: JSON.stringify({ action: 'save', nome: xssNome, cifra: '', artista: '', classificacao: '', bit: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const body = await res.json();
    const id = body.id;

    await page.goto('/index.php');
    await page.waitForLoadState('domcontentloaded');

    const xssRan = await page.evaluate(() => window.__xss_musica);
    expect(xssRan).toBeUndefined();

    // Cleanup
    if (id) {
      await page.request.post(MUSIC_API, {
        data: JSON.stringify({ action: 'delete', id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });

  test('artista com payload XSS é escapado', async ({ page }) => {
    const csrf = await getCsrf(page);
    const xssArtista = '<img src=x onerror="window.__xss_artista=1">';
    const res = await page.request.post(MUSIC_API, {
      data: JSON.stringify({ action: 'save', nome: '__XSS_ARTISTA_TEST__', cifra: '', artista: xssArtista, classificacao: '', bit: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const body = await res.json();
    const id = body.id;

    await page.goto('/index.php');
    await page.waitForLoadState('domcontentloaded');
    const xssRan = await page.evaluate(() => window.__xss_artista);
    expect(xssRan).toBeUndefined();

    if (id) {
      await page.request.post(MUSIC_API, {
        data: JSON.stringify({ action: 'delete', id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });

  test('nome de playlist com XSS é escapado', async ({ page }) => {
    const csrf = await getCsrf(page);
    const xssNome = '<script>window.__xss_playlist=1</script>';
    const res = await page.request.post(PLAYLIST_API, {
      data: JSON.stringify({ action: 'save', nome: xssNome, itens: [], visivel_ate: null }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const body = await res.json();
    const id = body.id;

    await page.goto('/index.php');
    await page.waitForLoadState('networkidle');
    const xssRan = await page.evaluate(() => window.__xss_playlist);
    expect(xssRan).toBeUndefined();

    if (id) {
      await page.request.post(PLAYLIST_API, {
        data: JSON.stringify({ action: 'delete', id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });

  test('título de roteiro com XSS é escapado', async ({ page }) => {
    const csrf = await getCsrf(page);
    const xssTitulo = '<script>window.__xss_roteiro=1</script>';
    const res = await page.request.post(ROTEIRO_API, {
      data: JSON.stringify({ action: 'save', titulo: xssTitulo, conteudo: 'Conteudo', visivel_ate: null }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const body = await res.json();
    const id = body.id;

    await page.goto('/roteiro.php');
    await page.waitForLoadState('networkidle');
    const xssRan = await page.evaluate(() => window.__xss_roteiro);
    expect(xssRan).toBeUndefined();

    if (id) {
      await page.request.post(ROTEIRO_API, {
        data: JSON.stringify({ action: 'delete', id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });
});

// ── SQL Injection via API ─────────────────────────────────────────────────────
test.describe('SQL Injection — campos de API', () => {
  test('nome de música com SQL injection é tratado com segurança', async ({ page }) => {
    const csrf = await getCsrf(page);
    const sqlNome = "'; DROP TABLE musicas; --";
    const res = await page.request.post(MUSIC_API, {
      data: JSON.stringify({ action: 'save', nome: sqlNome, cifra: '', artista: '', classificacao: '', bit: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    // Either succeeds (stored as literal string) or fails gracefully — never 500
    expect([200, 400, 422]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const id = body.id;
      if (id) {
        await page.request.post(MUSIC_API, {
          data: JSON.stringify({ action: 'delete', id }),
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        });
      }
    }
  });

  test('GET sync após SQL injection não retorna erro 500', async ({ page }) => {
    const res = await page.request.get('/api/sync/data.php');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.musicas)).toBe(true);
  });
});

// ── Boundary values ───────────────────────────────────────────────────────────
test.describe('Boundary values', () => {
  test('nome de música com 1 caractere é aceito ou rejeitado graciosamente', async ({ page }) => {
    const csrf = await getCsrf(page);
    const res = await page.request.post(MUSIC_API, {
      data: JSON.stringify({ action: 'save', nome: 'A', cifra: '', artista: '', classificacao: '', bit: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      if (body.id) {
        await page.request.post(MUSIC_API, {
          data: JSON.stringify({ action: 'delete', id: body.id }),
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        });
      }
    }
  });

  test('nome de música com 500 chars não causa crash', async ({ page }) => {
    const csrf = await getCsrf(page);
    const longNome = 'A'.repeat(500);
    const res = await page.request.post(MUSIC_API, {
      data: JSON.stringify({ action: 'save', nome: longNome, cifra: '', artista: '', classificacao: '', bit: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      if (body.id) {
        await page.request.post(MUSIC_API, {
          data: JSON.stringify({ action: 'delete', id: body.id }),
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        });
      }
    }
  });

  test('cifra com 100KB de conteúdo é aceita ou rejeitada graciosamente', async ({ page }) => {
    const csrf = await getCsrf(page);
    const bigCifra = 'Am G F\n'.repeat(10000);
    const res = await page.request.post(MUSIC_API, {
      data: JSON.stringify({ action: 'save', nome: '__BIG_CIFRA_TEST__', cifra: bigCifra, artista: '', classificacao: '', bit: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 413, 422]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      if (body.id) {
        await page.request.post(MUSIC_API, {
          data: JSON.stringify({ action: 'delete', id: body.id }),
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        });
      }
    }
  });

  test('playlist sem itens é válida', async ({ page }) => {
    const csrf = await getCsrf(page);
    const res = await page.request.post(PLAYLIST_API, {
      data: JSON.stringify({ action: 'save', nome: '__VAZIA__', itens: [], visivel_ate: null }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    if (body.id) {
      await page.request.post(PLAYLIST_API, {
        data: JSON.stringify({ action: 'delete', id: body.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });

  test('playlist com 200 itens não causa crash', async ({ page }) => {
    const csrf = await getCsrf(page);
    const manyItens = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, tom: 'C' }));
    const res = await page.request.post(PLAYLIST_API, {
      data: JSON.stringify({ action: 'save', nome: '__MANY_ITENS__', itens: manyItens, visivel_ate: null }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 413, 422]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      if (body.id) {
        await page.request.post(PLAYLIST_API, {
          data: JSON.stringify({ action: 'delete', id: body.id }),
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        });
      }
    }
  });
});

// ── Caracteres especiais ──────────────────────────────────────────────────────
test.describe('Caracteres especiais', () => {
  test('nome de música com emoji é aceito', async ({ page }) => {
    const csrf = await getCsrf(page);
    const res = await page.request.post(MUSIC_API, {
      data: JSON.stringify({ action: 'save', nome: '🎸 Rock Test 🎵', cifra: '', artista: '🎤 Artista', classificacao: '', bit: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      if (body.id) {
        await page.request.post(MUSIC_API, {
          data: JSON.stringify({ action: 'delete', id: body.id }),
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        });
      }
    }
  });

  test('nome de música com caracteres acentuados é aceito e exibido', async ({ page }) => {
    const csrf = await getCsrf(page);
    const res = await page.request.post(MUSIC_API, {
      data: JSON.stringify({ action: 'save', nome: 'Ação de Graças — Música Especial', cifra: 'Am Gm Fm', artista: 'Hïnário Ação', classificacao: '', bit: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      if (body.id) {
        // Verify it appears in sync data
        const syncRes = await page.request.get('/api/sync/data.php');
        const syncBody = await syncRes.json();
        const found = syncBody.musicas?.some(m => m.id === body.id || m.nome?.includes('Ação'));
        expect(found).toBeTruthy();

        await page.request.post(MUSIC_API, {
          data: JSON.stringify({ action: 'delete', id: body.id }),
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        });
      }
    }
  });

  test('roteiro com HTML no conteúdo é armazenado e escapado', async ({ page }) => {
    const csrf = await getCsrf(page);
    const htmlConteudo = '<b>bold</b><script>window.__roteiro_xss=1</script>';
    const res = await page.request.post(ROTEIRO_API, {
      data: JSON.stringify({ action: 'save', titulo: '__HTML_ROTEIRO__', conteudo: htmlConteudo, visivel_ate: null }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const body = await res.json();
    const id = body.id;

    await page.goto('/roteiro.php');
    await page.waitForLoadState('networkidle');
    const xssRan = await page.evaluate(() => window.__roteiro_xss);
    expect(xssRan).toBeUndefined();

    if (id) {
      await page.request.post(ROTEIRO_API, {
        data: JSON.stringify({ action: 'delete', id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });
});

// ── Requisições inválidas ─────────────────────────────────────────────────────
test.describe('Requisições inválidas', () => {
  test('action desconhecida na API de músicas retorna erro', async ({ page }) => {
    const csrf = await getCsrf(page);
    const res = await page.request.post(MUSIC_API, {
      data: JSON.stringify({ action: 'unknown_action', id: 1 }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.sucesso ?? body.ok).toBeFalsy();
    }
  });

  test('payload JSON com tipos incorretos não causa crash', async ({ page }) => {
    const csrf = await getCsrf(page);
    const res = await page.request.post(MUSIC_API, {
      data: JSON.stringify({ action: 'save', nome: 12345, cifra: null, artista: true }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422]).toContain(res.status());
  });

  test('payload completamente vazio retorna erro', async ({ page }) => {
    const csrf = await getCsrf(page);
    const res = await page.request.post(MUSIC_API, {
      data: '{}',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.sucesso ?? body.ok).toBeFalsy();
    }
  });

  test('ID numérico negativo em delete não causa crash', async ({ page }) => {
    const csrf = await getCsrf(page);
    const res = await page.request.post(MUSIC_API, {
      data: JSON.stringify({ action: 'delete', id: -1 }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422]).toContain(res.status());
  });

  test('ID string não numérico em delete não causa crash', async ({ page }) => {
    const csrf = await getCsrf(page);
    const res = await page.request.post(MUSIC_API, {
      data: JSON.stringify({ action: 'delete', id: 'abc' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422]).toContain(res.status());
  });
});

// ── Chamadas rápidas consecutivas ────────────────────────────────────────────
test.describe('Concorrência e chamadas rápidas', () => {
  test('múltiplas chamadas GET à sync API retornam 200', async ({ page }) => {
    const requests = Array.from({ length: 5 }, () => page.request.get('/api/sync/data.php'));
    const results = await Promise.all(requests);
    for (const res of results) {
      expect(res.status()).toBe(200);
    }
  });

  test('múltiplas chamadas ao status live retornam 200', async ({ page }) => {
    const requests = Array.from({ length: 5 }, () => page.request.get('/api/live/status.php'));
    const results = await Promise.all(requests);
    for (const res of results) {
      expect(res.status()).toBe(200);
    }
  });
});
