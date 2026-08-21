/**
 * 80-saude-do-schema.spec.js
 * Saúde do banco exposta pelo health.php.
 *
 * Nasceu de um incidente real: o banco de produção nunca tinha recebido uma
 * migration, todo sync autenticado respondia 500, e o health.php respondia
 * 'ok' porque não olhava para o banco. A suíte inteira passava — ela roda
 * contra um banco recriado do baseline a cada execução, que nasce sempre
 * completo. Estes testes fixam o contrato que fecha essa distância.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

test.describe('Saúde do schema', () => {
  test('a sonda de conectividade continua leve e não consulta o banco', async ({ page }) => {
    const res = await page.request.get('/health.php?probe=1');

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    // A sonda roda em timer, em toda sessão. Se ela passar a depender do
    // MySQL, uma lentidão do banco faz o app inteiro se declarar offline.
    expect(body).not.toHaveProperty('pending_migrations');
    expect(body).not.toHaveProperty('pending_count');
  });

  test('a checagem de schema acusa banco em dia', async ({ page }) => {
    const res = await page.request.get('/health.php?check=schema');

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.pending_count).toBe(0);
  });

  test('quem está autenticado enxerga quais migrations faltam', async ({ page }) => {
    const res = await page.request.get('/health.php?check=schema');

    expect((await res.json())).toHaveProperty('pending_migrations');
  });

  test('sem sessão o veredito aparece mas os nomes das migrations não vazam', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();

    const res = await page.request.get('/health.php?check=schema');

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.pending_count).toBe('number');
    expect(body).not.toHaveProperty('pending_migrations');
    await ctx.close();
  });
});
