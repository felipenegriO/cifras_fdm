import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function csrf(request) {
  return (await (await request.get('/api/csrf.php')).json()).csrf_token;
}

async function post(request, endpoint, payload) {
  return request.post(endpoint, {
    data: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': await csrf(request),
    },
  });
}

test.describe('categorias/api.php — branches residuais', () => {
  const endpoint = '/src/backend/categorias/api.php';

  test('rejeita método, JSON vazio, exclusão inválida e nome inválido', async ({ request }) => {
    const method = await request.put(endpoint);
    expect(method.status()).toBe(405);

    for (const payload of [
      { action: 'delete', id: null },
      { action: 'delete', id: 'abc' },
      { nome: '' },
      { nome: 'a'.repeat(121) },
    ]) {
      const response = await post(request, endpoint, payload);
      expect(response.status()).toBe(422);
      expect(await response.json()).toMatchObject({ ok: false });
    }
  });

  test('detecta conflito de revisão', async ({ request }) => {
    const response = await post(request, endpoint, {
      nome: `Conflito ${Date.now()}`,
      baseRevision: -1,
    });
    expect(response.status()).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false });
  });
});

test.describe('editor/api.php — branches residuais', () => {
  const endpoint = '/src/backend/editor/api.php';

  test('rejeita JSON inválido e payload incompleto', async ({ request }) => {
    const token = await csrf(request);
    const invalid = await request.post(endpoint, {
      data: '{',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    });
    expect(await invalid.json()).toMatchObject({ ok: false });

    const incomplete = await post(request, endpoint, {});
    expect(await incomplete.json()).toMatchObject({ ok: false, error: 'Dados incompletos' });
  });

  test('rejeita ids inválidos, registros ausentes e limites dos campos', async ({ request }) => {
    for (const payload of [
      { action: 'copy' },
      { action: 'copy', id: 'abc' },
      { action: 'delete' },
      { action: 'delete', id: 'abc' },
      { action: 'copy', id: 99999999 },
      { action: 'delete', id: 99999999 },
    ]) {
      const response = await post(request, endpoint, payload);
      expect([200, 400, 404, 422]).toContain(response.status());
      expect(await response.json()).toMatchObject({ ok: false });
    }

    for (const payload of [
      { nome: '', cifra: '' },
      { nome: 'a'.repeat(201), cifra: '' },
      { nome: 'Válida', artista: 'a'.repeat(201), cifra: '' },
      { nome: 'Válida', bit: '1'.repeat(51), cifra: '' },
    ]) {
      const response = await post(request, endpoint, payload);
      expect(response.status()).toBe(422);
    }
  });

  test('rejeita categoria não cadastrada e conflito de revisão', async ({ request }) => {
    const category = await post(request, endpoint, {
      nome: 'Música categoria inválida',
      cifra: '<b>C</b>',
      classificacao: `Ausente ${Date.now()}`,
    });
    expect(category.status()).toBe(422);

    const conflict = await post(request, endpoint, {
      nome: 'Música em conflito',
      cifra: '<b>C</b>',
      baseRevision: -1,
    });
    expect(conflict.status()).toBe(409);
  });
});

test.describe('salvar_roteiros.php — branches residuais', () => {
  const endpoint = '/src/backend/editor/salvar_roteiros.php';

  test('rejeita JSON inválido, dados incompletos e conteúdo inválido', async ({ request }) => {
    const token = await csrf(request);
    const invalid = await request.post(endpoint, {
      data: '{',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    });
    expect([200, 400]).toContain(invalid.status());
    expect(await invalid.json()).toMatchObject({ ok: false });

    expect(await (await post(request, endpoint, {})).json()).toMatchObject({ ok: false });
    const empty = await post(request, endpoint, { titulo: '', conteudo: '' });
    expect(empty.status()).toBe(422);
  });

  test('trata exclusão inexistente e conflito de revisão', async ({ request }) => {
    const missing = await post(request, endpoint, { deleteId: 99999999 });
    expect(await missing.json()).toMatchObject({ ok: false });

    const conflict = await post(request, endpoint, {
      titulo: 'Roteiro conflito',
      conteudo: 'Conteúdo',
      baseRevision: -1,
    });
    expect(conflict.status()).toBe(409);
  });
});

test.describe('salvar_config.php — branches residuais', () => {
  const endpoint = '/src/backend/users/salvar_config.php';

  test('rejeita método e formatos de payload inválidos', async ({ request }) => {
    expect((await request.get(endpoint)).status()).toBe(200);
    for (const payload of [null, {}, { config: 'texto' }]) {
      const response = await post(request, endpoint, payload);
      expect(await response.json()).toMatchObject({ sucesso: false });
    }
  });

  test('ignora chave desconhecida, rejeita valor inválido e salva valores válidos', async ({ request }) => {
    const ignored = await post(request, endpoint, { config: { desconhecida: 'x' } });
    expect(await ignored.json()).toMatchObject({ sucesso: true });

    const invalid = await post(request, endpoint, { config: { tema: 'inexistente' } });
    expect(invalid.status()).toBe(422);

    const valid = await post(request, endpoint, {
      config: { tema: 'dark', cifraSize: '18', scrollSpeed: 'normal', keepAwake: 'true' },
    });
    expect(await valid.json()).toMatchObject({ sucesso: true });
  });
});
