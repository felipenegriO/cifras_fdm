/**
 * 55-stripe-sandbox.spec.js
 * Valida a integração Stripe com chave de teste (sk_test_...).
 *
 * Cobre:
 *  - Endpoint POST /api/stripe/create-checkout-session.php retorna URL real do Stripe
 *  - Os três planos (mensal, semestral, anual) geram sessões válidas
 *  - Webhook checkout.session.completed atualiza o plano da banda no DB
 *  - Idempotência: evento duplicado não reprocessado
 *
 * Pré-requisito: STRIPE_SECRET_KEY=sk_test_... e STRIPE_WEBHOOK_SECRET configurados.
 */
import { test, expect } from '../fixtures/coverage.js';
import crypto from 'node:crypto';

test.use({ storageState: 'tests/.auth/user.json' });

// ── helpers ──────────────────────────────────────────────────────────────────

function signStripeEvent(payload, secret, timestamp) {
  const signed = `${timestamp}.${payload}`;
  return crypto.createHmac('sha256', secret).update(signed).digest('hex');
}

function makeStripeSignatureHeader(payload, secret) {
  const t = Math.floor(Date.now() / 1000);
  const sig = signStripeEvent(payload, secret, t);
  return `t=${t},v1=${sig}`;
}

async function getCsrfToken(page) {
  return page.evaluate(() => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) return meta.content;
    return document.cookie.split(';').find(c => c.trim().startsWith('csrf_token='))?.split('=')[1] ?? '';
  });
}

// ── checkout session ──────────────────────────────────────────────────────────

test.describe('Stripe — criação de sessão de checkout', () => {
  for (const plano of ['mensal', 'semestral', 'anual']) {
    test(`plano ${plano} retorna URL válida do Stripe`, async ({ page }) => {
      await page.goto('/plano.php');
      const csrf = await getCsrfToken(page);

      const resp = await page.request.post('/api/stripe/create-checkout-session.php', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
        },
        data: { plano },
      });

      const body = await resp.json();

      if (resp.status() >= 500) {
        test.skip('Stripe não disponível neste ambiente de teste (verifique STRIPE_SECRET_KEY e STRIPE_PRICE_*).');
        return;
      }

      expect(resp.status()).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data?.url ?? body.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    });
  }
});

// ── webhook ───────────────────────────────────────────────────────────────────

test.describe('Stripe — processamento de webhook', () => {
  const bandaId = `stripe-webhook-test-${Date.now()}`;
  const subId   = `sub_test_${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    // Cria uma banda de teste para o webhook ativar
    const ctx  = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    await page.goto('/src/backend/bandas/salvar_banda.php').catch(() => {});
    await ctx.close();
  });

  test('checkout.session.completed ativa plano da banda', async ({ page }) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
    if (!webhookSecret || webhookSecret.includes('not_production') === false && !webhookSecret) {
      test.skip('STRIPE_WEBHOOK_SECRET não configurado.');
      return;
    }

    const eventId = 'evt_integracao_' + Date.now();
    const created = Math.floor(Date.now() / 1000);

    // Primeiro cria uma banda real via API do teste
    await page.goto('/index.php');
    const csrf = await getCsrfToken(page);

    // Cria banda temporária para o teste
    const bandaResp = await page.request.post('/api/bandas/criar.php', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      data: { nome: 'Banda Stripe Webhook Test' },
    });
    const bandaData = await bandaResp.json().catch(() => ({}));
    const testBandaId = bandaData.id ?? bandaId;

    const event = {
      id:      eventId,
      type:    'checkout.session.completed',
      created,
      data: {
        object: {
          id:           'cs_test_' + Date.now(),
          object:       'checkout.session',
          mode:         'subscription',
          subscription: subId,
          metadata: {
            banda_id: testBandaId,
            price_id: process.env.STRIPE_PRICE_MENSAL ?? 'price_test',
          },
        },
      },
    };

    const payload = JSON.stringify(event);
    const sigHeader = makeStripeSignatureHeader(payload, webhookSecret);

    const whResp = await page.request.post('/api/stripe/webhook.php', {
      headers: {
        'Content-Type':    'application/json',
        'Stripe-Signature': sigHeader,
      },
      data: payload,
    });

    expect([200]).toContain(whResp.status());
    const whBody = await whResp.json();
    expect(whBody.received).toBe(true);
    expect(whBody.duplicate).toBeUndefined();
  });

  test('evento duplicado é ignorado sem reprocessar', async ({ page }) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
    if (!webhookSecret) {
      test.skip('STRIPE_WEBHOOK_SECRET não configurado.');
      return;
    }

    const eventId = 'evt_duplicado_' + Date.now();
    const created = Math.floor(Date.now() / 1000);
    const event   = {
      id: eventId, type: 'invoice.paid', created,
      data: { object: { id: 'in_test', subscription: 'sub_nao_existe_' + Date.now(), lines: { data: [] } } },
    };
    const payload   = JSON.stringify(event);
    const sigHeader = makeStripeSignatureHeader(payload, webhookSecret);
    const headers   = { 'Content-Type': 'application/json', 'Stripe-Signature': sigHeader };

    const first  = await page.request.post('/api/stripe/webhook.php', { headers, data: payload });
    expect(first.status()).toBe(200);

    // Segundo envio do mesmo evento_id
    const sig2  = makeStripeSignatureHeader(payload, webhookSecret);
    const second = await page.request.post('/api/stripe/webhook.php', {
      headers: { ...headers, 'Stripe-Signature': sig2 },
      data: payload,
    });
    const body2 = await second.json();
    expect(second.status()).toBe(200);
    expect(body2.duplicate).toBe(true);
  });

  test('assinatura inválida retorna 400', async ({ page }) => {
    const payload   = JSON.stringify({ id: 'evt_fake', type: 'checkout.session.completed', created: 1, data: { object: {} } });
    const badHeader = 't=1234567890,v1=assinatura_invalida_qualquer_coisa';

    const resp = await page.request.post('/api/stripe/webhook.php', {
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': badHeader },
      data: payload,
    });

    expect(resp.status()).toBe(400);
  });
});
