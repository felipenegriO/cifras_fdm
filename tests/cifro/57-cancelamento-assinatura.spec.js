/**
 * 57-cancelamento-assinatura.spec.js
 *
 * Cancelamento self-service da assinatura — POST /api/plano/cancelar.php.
 *
 * A landing promete "cancela quando quiser, sem multa e sem fidelidade".
 * Estes testes existem para que a promessa continue verdadeira.
 *
 * Regra central: cancelar agenda o fim da cobrança, NUNCA corta acesso já pago.
 */
import { test, expect } from '../fixtures/coverage.js';
import { dbQuery } from '../helpers/db.js';
import { fazerLogin } from '../helpers/auth.js';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * O endpoint limita a 5 pedidos por 10 minutos por banda — proteção correta em
 * produção, mas os testes estouram a janela porque disparam vários pedidos
 * seguidos. Os baldes ficam em arquivo no temp; zerar antes de cada teste
 * mantém o limite real em produção e os testes determinísticos.
 */
test.beforeEach(async ({ page }) => {
  rmSync(path.join(tmpdir(), 'cifro-rate-limit'), { recursive: true, force: true });
  // tests/.auth/user.json é compartilhado entre todos os specs; um teste
  // anterior que faça session_regenerate_id() (ex.: 53-convite-ponta-a-ponta)
  // invalida o cookie salvo para todo mundo que rodar depois. fazerLogin()
  // é um no-op se a sessão ainda estiver válida e reloga se não estiver.
  await fazerLogin(page);
});

async function getCsrf(page) {
  const res = await page.request.get('/api/csrf.php');
  const body = await res.json();
  return body.csrf_token || '';
}

/** Cancelar exige POST autenticado com CSRF — este é o caminho legítimo. */
async function pedirCancelamento(page) {
  const csrf = await getCsrf(page);
  return page.request.post('/api/plano/cancelar.php', {
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
}

async function bandaAtualId(page) {
  const versao = await (await page.request.get('/api/sync/version.php')).json();
  return versao.banda_id;
}

/**
 * Ajusta o estado de assinatura da banda e reseleciona a banda para que a
 * sessão (de onde a view lê o plano) enxergue a mudança.
 */
async function comAssinatura(page, { plano, subscriptionId = null, cancelado = null, expiraEm = null }, run) {
  const bandId = await bandaAtualId(page);
  const anterior = dbQuery(
    'SELECT plano, stripe_subscription_id, cancelamento_agendado_em, plano_expira_em FROM bandas WHERE id=?',
    [bandId],
  ).rows[0];

  dbQuery(
    `UPDATE bandas SET plano=?, stripe_subscription_id=?, cancelamento_agendado_em=?, plano_expira_em=? WHERE id=?`,
    [plano, subscriptionId, cancelado, expiraEm, bandId],
  );
  await reselecionar(page, bandId);

  try {
    await run(bandId);
  } finally {
    dbQuery(
      `UPDATE bandas SET plano=?, stripe_subscription_id=?, cancelamento_agendado_em=?, plano_expira_em=? WHERE id=?`,
      [
        anterior?.plano ?? 'gratuito',
        anterior?.stripe_subscription_id ?? null,
        anterior?.cancelamento_agendado_em ?? null,
        anterior?.plano_expira_em ?? null,
        bandId,
      ],
    );
    await reselecionar(page, bandId);
  }
}

async function reselecionar(page, bandId) {
  const csrf = await getCsrf(page);
  await page.request.post('/src/backend/bandas/selecionar.php', {
    data: JSON.stringify({ bandaId: bandId }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
}

function lerBanda(bandId) {
  return dbQuery(
    'SELECT plano, stripe_subscription_id, cancelamento_agendado_em FROM bandas WHERE id=?',
    [bandId],
  ).rows[0];
}

// ── Regras de negócio ─────────────────────────────────────────────────────────
test.describe('Cancelamento — quem pode cancelar', () => {
  test('banda no plano gratuito recebe recusa explícita', async ({ page }) => {
    await comAssinatura(page, { plano: 'gratuito' }, async () => {
      const res = await pedirCancelamento(page);
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('sem_assinatura_ativa');
    });
  });

  test('plano pago por Pix responde que não há recorrência a cancelar', async ({ page }) => {
    await comAssinatura(page, { plano: 'anual', subscriptionId: null }, async (bandId) => {
      const res = await pedirCancelamento(page);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.codigo).toBe('sem_recorrencia');
      expect(body.data.mensagem).toMatch(/não será renovado/i);

      // Cancelar nunca corta acesso já pago
      expect(lerBanda(bandId).plano).toBe('anual');
    });
  });

  test('pedir cancelamento duas vezes não é erro nem cobra de novo', async ({ page }) => {
    await comAssinatura(
      page,
      { plano: 'mensal', subscriptionId: 'sub_e2e123', cancelado: '2026-08-07 20:00:00' },
      async (bandId) => {
        const res = await pedirCancelamento(page);
        expect(res.status()).toBe(200);
        expect((await res.json()).data.codigo).toBe('ja_cancelado');
        expect(lerBanda(bandId).plano).toBe('mensal');
      },
    );
  });
});

// ── Segurança ─────────────────────────────────────────────────────────────────
test.describe('Cancelamento — segurança', () => {
  test('visitante não autenticado não cancela assinatura de ninguém', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const res = await ctx.request.post('/api/plano/cancelar.php');
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('requisição forjada sem token CSRF é recusada e nada é gravado', async ({ page }) => {
    await comAssinatura(page, { plano: 'mensal', subscriptionId: 'sub_e2e123' }, async (bandId) => {
      const res = await page.request.post('/api/plano/cancelar.php', {
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBe(403);
      expect(lerBanda(bandId).cancelamento_agendado_em).toBeNull();
      expect(lerBanda(bandId).plano).toBe('mensal');
    });
  });

  test('GET não cancela nada — só POST', async ({ page }) => {
    await comAssinatura(page, { plano: 'mensal', subscriptionId: 'sub_e2e123' }, async (bandId) => {
      const res = await page.request.get('/api/plano/cancelar.php');
      expect(res.status()).toBe(405);
      expect(lerBanda(bandId).cancelamento_agendado_em).toBeNull();
    });
  });

  test('marteladas repetidas no endpoint são barradas pelo rate limit', async ({ page }) => {
    await comAssinatura(page, { plano: 'mensal', subscriptionId: 'sub_e2e123' }, async (bandId) => {
      const status = [];
      for (let tentativa = 0; tentativa < 7; tentativa++) {
        status.push((await pedirCancelamento(page)).status());
      }
      // 5 pedidos por 10 minutos: as últimas tentativas precisam ser barradas
      expect(status).toContain(429);
      expect(lerBanda(bandId).cancelamento_agendado_em).toBeNull();
    });
  });

  test('sem Stripe configurado o endpoint falha fechado, sem marcar cancelamento', async ({ page }) => {
    await comAssinatura(page, { plano: 'mensal', subscriptionId: 'sub_e2e123' }, async (bandId) => {
      const res = await pedirCancelamento(page);
      // Sem STRIPE_SECRET_KEY real, precisa recusar explicitamente em vez de
      // fingir que cancelou — nunca marcar cancelamento que o Stripe não viu.
      expect([502, 503]).toContain(res.status());
      expect(lerBanda(bandId).cancelamento_agendado_em).toBeNull();
      expect(lerBanda(bandId).plano).toBe('mensal');
    });
  });
});

// ── Interface ─────────────────────────────────────────────────────────────────
test.describe('Cancelamento — tela de plano', () => {
  test('plano gratuito não mostra bloco de cancelamento', async ({ page }) => {
    await comAssinatura(page, { plano: 'gratuito' }, async () => {
      await page.goto('/plano.php');
      await expect(page.locator('#plan-cancel-block')).toHaveCount(0);
    });
  });

  test('cancelamento já agendado aparece como estado, sem botão de cancelar de novo', async ({ page }) => {
    await comAssinatura(
      page,
      {
        plano: 'mensal',
        subscriptionId: 'sub_e2e123',
        cancelado: '2026-08-07 20:00:00',
        expiraEm: '2026-09-07 20:00:00',
      },
      async () => {
        await page.goto('/plano.php');
        const bloco = page.locator('#plan-cancel-block');
        await expect(bloco).toContainText(/cancelamento agendado/i);
        await expect(bloco).toContainText(/07\/09\/2026/);
        await expect(bloco).toContainText(/cifras continuam salvas/i);
        await expect(page.locator('#btn-cancelar-plano')).toHaveCount(0);
      },
    );
  });

  test('plano pago sem recorrência cai no atendimento, não no botão automático', async ({ page }) => {
    await comAssinatura(page, { plano: 'anual', subscriptionId: null }, async () => {
      await page.goto('/plano.php');
      await expect(page.locator('#plan-cancel-block')).toContainText(/solicitar cancelamento/i);
      await expect(page.locator('#btn-cancelar-plano')).toHaveCount(0);
    });
  });
});
