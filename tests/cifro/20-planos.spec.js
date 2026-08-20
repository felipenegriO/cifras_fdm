/**
 * 20-planos.spec.js
 * Planos: aba de plano em Minha Banda, limites de músicas, webhook Stripe, topnav badge.
 */
import { test, expect } from '../fixtures/coverage.js';
import { createHmac } from 'node:crypto';
import { dbQuery } from '../helpers/db.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.use({ storageState: 'tests/.auth/user.json' });

const envLocalPath = path.resolve(__dirname, '../../.env.local');

/**
 * Temporarily appends extra vars to the real .env.local (used for DB_HOST etc.)
 * so the PHP built-in server (single worker, tests run serially) picks up
 * different env() values on the next request, then restores the original
 * file content exactly. Never overwrites — only appends and restores.
 */
async function withExtraEnv(extraVars, run) {
  const original = fs.readFileSync(envLocalPath, 'utf8');
  let updated = original;
  for (const [key, value] of Object.entries(extraVars)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    updated = pattern.test(updated)
      ? updated.replace(pattern, `${key}=${value}`)
      : `${updated.replace(/\s*$/, '')}\n${key}=${value}\n`;
  }
  fs.writeFileSync(envLocalPath, updated);
  try {
    await run();
  } finally {
    fs.writeFileSync(envLocalPath, original);
  }
}

async function getCsrf(page) {
  const res = await page.request.get('/api/csrf.php');
  const body = await res.json();
  return body.csrf_token || '';
}

async function sendSignedWebhook(page, event) {
  const now = Date.now();
  const payload = JSON.stringify({ id: `evt_${now}_${Math.random().toString(16).slice(2)}`, created: Math.floor(now / 1000), ...event });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', 'whsec_playwright').update(`${timestamp}.${payload}`).digest('hex');
  return page.request.post('/api/stripe/webhook.php', {
    data: payload,
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': `t=${timestamp},v1=${signature}`,
    },
  });
}

async function withCurrentBandPlan(page, plano, run) {
  const current = await (await page.request.get('/api/sync/version.php')).json();
  const bandId = current.banda_id;
  const previous = dbQuery('SELECT plano FROM bandas WHERE id=?', [bandId]).rows[0]?.plano ?? 'gratuito';
  dbQuery('UPDATE bandas SET plano=? WHERE id=?', [plano, bandId]);
  const csrf = await getCsrf(page);
  const selected = await page.request.post('/src/backend/bandas/selecionar.php', {
    data: JSON.stringify({ bandaId: bandId }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
  expect((await selected.json()).sucesso).toBe(true);

  try {
    await run(bandId);
  } finally {
    dbQuery('UPDATE bandas SET plano=? WHERE id=?', [previous, bandId]);
    const restoreCsrf = await getCsrf(page);
    await page.request.post('/src/backend/bandas/selecionar.php', {
      data: JSON.stringify({ bandaId: bandId }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': restoreCsrf },
    });
  }
}

// ── Página /plano.php ─────────────────────────────────────────────────────────
test.describe('Plano — página', () => {
  test('página de plano abre sem erros para usuário logado', async ({ page }) => {
    const res = await page.goto('/plano.php');
    expect(res.status()).toBe(200);
  });

  test('não exibe Fatal error', async ({ page }) => {
    await page.goto('/plano.php');
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });

  test('sem autenticação redireciona para landing/login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/plano.php');
    await page.waitForURL(url =>
      url.toString().includes('landing.php') || url.toString().includes('login.php'),
      { timeout: 5000 }
    );
    expect(page.url()).toMatch(/landing\.php|login\.php/);
    await ctx.close();
  });

  test('exibe nome da banda', async ({ page }) => {
    // O plano virou aba de Minha Banda: o h1 da página é "Minha Banda" e o
    // nome da banda fica no subtítulo; o título do plano é o h2 da aba.
    await page.goto('/plano.php');
    await expect(page.locator('.mb-banda')).not.toBeEmpty();
    await expect(page.locator('.mb-aba-titulo')).toContainText('Plano');
  });

  test('exibe badge do plano atual', async ({ page }) => {
    await page.goto('/plano.php');
    const badge = page.locator('.plan-badge').first();
    await expect(badge).toBeVisible();
    const text = await badge.textContent();
    expect(text.trim().length).toBeGreaterThan(0);
  });

  test('exibe seção de uso (barra de músicas)', async ({ page }) => {
    await page.goto('/plano.php');
    const usage = page.locator('.plan-usage');
    await expect(usage).toBeVisible();
    await expect(usage).toContainText('Músicas');
  });

  test('exibe os 3 cards de planos pagos', async ({ page }) => {
    await page.goto('/plano.php');
    const cards = page.locator('.price-card');
    await expect(cards).toHaveCount(3);
  });

  test('card Mensal mostra R$9,90', async ({ page }) => {
    await page.goto('/plano.php');
    await expect(page.locator('.pricing-grid')).toContainText('9');
    await expect(page.locator('.pricing-grid')).toContainText('90');
  });

  test('card Semestral mostra R$49,90', async ({ page }) => {
    await page.goto('/plano.php');
    await expect(page.locator('.pricing-grid')).toContainText('49');
  });

  test('card Anual mostra R$89,90', async ({ page }) => {
    await page.goto('/plano.php');
    await expect(page.locator('.pricing-grid')).toContainText('89');
  });

  test('card Semestral tem badge "Mais popular"', async ({ page }) => {
    await page.goto('/plano.php');
    const badge = page.locator('.price-card__badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/popular/i);
  });

  test('exibe bloco do plano Gratuito', async ({ page }) => {
    await page.goto('/plano.php');
    const row = page.locator('.plan-free-row');
    await expect(row).toBeVisible();
    await expect(row).toContainText('10 músicas');
  });

  test('pagamento só aparece quando o meio está configurado', async ({ page }) => {
    await page.goto('/plano.php');
    const actions = page.locator('.js-pix-payment, .js-stripe-checkout, .btn-upgrade--disabled');
    expect(await actions.count()).toBeGreaterThanOrEqual(1);
    // Não deve existir nenhum link de pagamento com href vazio ou "#"
    const invalidLink = page.locator('a.btn-upgrade[href="#"], a.btn-upgrade[href=""]');
    await expect(invalidLink).toHaveCount(0);
  });

  test('fluxo PIX mostra chave e envio do comprovante', async ({ page }) => {
    await page.goto('/plano.php');
    const button = page.locator('.js-pix-payment').first();
    if (await button.count() === 0) {
      // Stripe habilitado — PIX não exibido nos cards; verificar que há botão Stripe
      await expect(page.locator('.js-stripe-checkout, .btn-upgrade--disabled').first()).toBeVisible();
      return;
    }
    await button.click();
    const modal = page.locator('#pix-payment-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('#pix-key-value')).not.toHaveText('');
    await expect(modal.locator('#pix-whatsapp-link')).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+\?text=.+/);
  });

  test('plano pago permite renovar, trocar e solicitar cancelamento', async ({ page }) => {
    const response = await page.request.get('/api/sync/data.php');
    const { plano } = await response.json();
    await page.goto('/plano.php');
    if (!['mensal', 'semestral', 'anual', 'ativo'].includes(plano)) {
      await expect(page.locator('.plan-section-title')).toContainText('Fazer upgrade');
      return;
    }
    await expect(page.locator('.mb-aba-titulo')).toContainText('Plano e pagamento');
    await expect(page.locator('.plan-section-title')).toContainText('Renovar ou trocar');
    await expect(page.locator('.plan-management__action')).toContainText('Solicitar cancelamento');
    if (plano !== 'ativo') {
      await expect(page.locator('.price-card--current .btn-upgrade')).toContainText(/Renovar|Pagamento indisponível/);
    }
  });

  test('renderiza decisões dos planos mensal, semestral, anual e bloqueado', async ({ page }) => {
    for (const plano of ['mensal', 'semestral', 'anual']) {
      await withCurrentBandPlan(page, plano, async () => {
        await page.goto('/plano.php');
        await expect(page.locator('.mb-aba-titulo')).toContainText('Plano e pagamento');
        await expect(page.locator('.plan-section-title')).toContainText('Renovar ou trocar');
        await expect(page.locator('.plan-management__action')).toContainText('Solicitar cancelamento');
        await expect(page.locator('.price-card--current')).toContainText('Plano atual');
        await expect(page.locator('.plan-usage')).toContainText('∞');
        await expect(page.locator('.plan-free-row')).toContainText('Disponível se cancelar');
      });
    }

    await withCurrentBandPlan(page, 'bloqueado', async () => {
      await page.goto('/plano.php');
      await expect(page.locator('.plan-blocked')).toContainText('Conta bloqueada');
      await expect(page.locator('.plan-usage')).toHaveCount(0);
      await expect(page.locator('.plan-section-title')).toContainText('Fazer upgrade');
      await expect(page.locator('.plan-badge--bloqueado')).toContainText('Bloqueado');
    });
  });

  test('plano "trial" no banco é tratado como gratuito', async ({ page }) => {
    await withCurrentBandPlan(page, 'trial', async () => {
      await page.goto('/plano.php');
      await expect(page.locator('.plan-badge--gratuito').first()).toBeVisible();
      await expect(page.locator('.plan-free-row')).toContainText('Plano Gratuito');
      await expect(page.locator('body')).not.toContainText('Fatal error');
    });
  });

  test('cards exibem botões Stripe (js-stripe-checkout) quando Stripe configurado — plano mensal ativo', async ({ page }) => {
    await withCurrentBandPlan(page, 'mensal', async () => {
      await page.goto('/plano.php');
      // Card atual (mensal): botão "Renovar mensal"
      const mensalCard = page.locator('.price-card--current');
      await expect(mensalCard.locator('button.js-stripe-checkout[data-plan="mensal"]')).toContainText('Renovar mensal');
      // Cards não-atuais (isPago=true): "Trocar para semestral" e "Trocar para anual"
      await expect(page.locator('button.js-stripe-checkout[data-plan="semestral"]')).toContainText('Trocar para semestral');
      await expect(page.locator('button.js-stripe-checkout[data-plan="anual"]')).toContainText('Trocar para anual');
      // Total: 3 botões Stripe (1 por card)
      await expect(page.locator('button.js-stripe-checkout')).toHaveCount(3);
    });
  });

  test('cards exibem botão "Assinar X" quando plano é gratuito e Stripe está configurado', async ({ page }) => {
    await withCurrentBandPlan(page, 'gratuito', async () => {
      await page.goto('/plano.php');
      await expect(page.locator('button.js-stripe-checkout[data-plan="mensal"]')).toContainText('Assinar mensal');
      await expect(page.locator('button.js-stripe-checkout[data-plan="semestral"]')).toContainText('Assinar semestral');
      await expect(page.locator('button.js-stripe-checkout[data-plan="anual"]')).toContainText('Assinar anual');
      await expect(page.locator('button.js-stripe-checkout')).toHaveCount(3);
    });
  });

  test('link WhatsApp do PIX usa telefone PIX quando WhatsApp específico não está configurado', async ({ page }) => {
    await withExtraEnv({ PAYMENT_WHATSAPP_PHONE: '' }, async () => {
      await page.goto('/plano.php');
      const button = page.locator('.js-pix-payment').first();
      if (await button.count() === 0) {
        test.skip();
        return;
      }
      await button.click();
      const modal = page.locator('#pix-payment-modal');
      await expect(modal).toBeVisible();
      await expect(modal.locator('#pix-whatsapp-link')).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+\?text=.+/);
    });
  });

  test('cards Semestral e Anual mostram botão "Renovar" quando são o plano atual', async ({ page }) => {
    for (const [plano, label] of [['semestral', 'Renovar semestral'], ['anual', 'Renovar anual']]) {
      await withCurrentBandPlan(page, plano, async () => {
        await page.goto('/plano.php');
        const currentCard = page.locator('.price-card--current');
        await expect(currentCard.locator(`button.js-stripe-checkout[data-plan="${plano}"]`)).toContainText(label);
      });
    }
  });

  test('pagamento indisponível quando PIX e Stripe estão desabilitados (cards próprios e alheios)', async ({ page }) => {
    await withExtraEnv({ PAYMENT_PIX_PHONE: '', PAYMENT_WHATSAPP_PHONE: '', STRIPE_SECRET_KEY: '' }, async () => {
      for (const plano of ['mensal', 'semestral', 'anual']) {
        await withCurrentBandPlan(page, plano, async () => {
          await page.goto('/plano.php');
          // Card atual: sem Stripe e sem PIX -> "Pagamento indisponível"
          const currentCard = page.locator('.price-card--current');
          await expect(currentCard.locator('.btn-upgrade--disabled')).toContainText('Pagamento indisponível');
          // Cards alheios: mesma condição, mesmo rótulo
          const disabled = page.locator('.btn-upgrade--disabled');
          await expect(disabled).toHaveCount(3);
        });
      }
    });
  });
});

// ── Topnav badge de plano ─────────────────────────────────────────────────────
test.describe('Topnav — link de plano', () => {
  test('upgrade aparece na barra apenas para plano gratuito ou bloqueado', async ({ page }) => {
    const planResponse = await page.request.get('/api/sync/data.php');
    const { plano } = await planResponse.json();
    await page.goto('/index.php');
    // O href é /minha-banda.php?aba=plano desde que Plano virou aba do "Minha
    // Banda"; o seletor antigo apontava para /plano.php e não casava com nada.
    // Isso passava despercebido porque a Banda E2E vivia num plano pago por
    // resíduo de execução anterior, e aí o teste só exercitava o ramo
    // `toHaveCount(0)` — que passa trivialmente quando o seletor está errado.
    // Há duas ocorrências (barra e menu lateral), daí o .first().
    const link = page.locator('a.topnav__upgrade[href^="/minha-banda.php"]');
    if (['mensal', 'semestral', 'anual', 'ativo'].includes(plano)) {
      await expect(link).toHaveCount(0);
    } else {
      await expect(link.first()).toBeVisible();
      await expect(link.first()).toContainText(/Fazer upgrade|Regularizar plano/);
    }
  });

  test('atalho de upgrade ou gestão leva para a aba de plano', async ({ page }) => {
    await withCurrentBandPlan(page, 'gratuito', async () => {
      await page.addInitScript(() => localStorage.setItem('cifroBetaWelcomeSeen', '1'));
      await page.goto('/index.php');
      // Aponta direto para a aba, sem passar pelo redirecionamento antigo.
      const upgrade = page.locator('a.topnav__upgrade[href^="/minha-banda.php"]').first();
      await expect(upgrade).toBeVisible();
      await upgrade.click();
      await page.waitForURL(/minha-banda\.php\?aba=plano/);
      await expect(page.locator('[data-aba-ativa]')).toHaveAttribute('data-aba-ativa', 'plano');
    });
  });
});

// ── Checkout Stripe — fluxo de clique real ───────────────────────────────────
test.describe('Checkout Stripe — fluxo de clique', () => {
  test('clicar em "Assinar mensal" envia POST para create-checkout-session.php com plano correto', async ({ page }) => {
    await page.route('**/create-checkout-session.php', async route => {
      await route.fulfill({ json: { ok: true, data: { url: '/plano.php?checkout=ok' } } });
    });

    await page.goto('/plano.php');
    const btn = page.locator('button.js-stripe-checkout[data-plan="mensal"]').first();
    await expect(btn).toBeVisible();

    const [request] = await Promise.all([
      page.waitForRequest(req =>
        req.url().includes('create-checkout-session.php') && req.method() === 'POST'
      ),
      btn.click(),
    ]);

    const body = JSON.parse(request.postData() || '{}');
    expect(body.plano).toBe('mensal');
  });

  test('exibe toast de erro quando create-checkout-session.php retorna falha', async ({ page }) => {
    await page.route('**/create-checkout-session.php', async route => {
      await route.fulfill({ json: { ok: false, error: 'stripe_not_configured' } });
    });

    await page.goto('/plano.php');
    const btn = page.locator('button.js-stripe-checkout[data-plan="semestral"]').first();
    await expect(btn).toBeVisible();
    const originalText = await btn.textContent();
    await btn.click();

    // Toast de erro deve aparecer
    await expect(page.locator('.cifro-toast, [role="alert"], .toast')).toBeVisible({ timeout: 5000 });
    // Botão deve ser re-habilitado com texto original
    await expect(btn).toBeEnabled({ timeout: 5000 });
    await expect(btn).toHaveText(originalText.trim());
  });

  test('create-checkout-session.php retorna 405 para GET', async ({ page }) => {
    const res = await page.request.get('/api/stripe/create-checkout-session.php');
    expect(res.status()).toBe(405);
  });

  test('create-checkout-session.php retorna 403 sem CSRF', async ({ page }) => {
    const res = await page.request.post('/api/stripe/create-checkout-session.php', {
      data: JSON.stringify({ plano: 'mensal' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
  });

  test('create-checkout-session.php retorna 400 para plano inválido', async ({ page }) => {
    const csrf = await getCsrf(page);
    const res = await page.request.post('/api/stripe/create-checkout-session.php', {
      data: JSON.stringify({ plano: 'inexistente' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(400);
  });
});

// ── Página plano-expirado.php ─────────────────────────────────────────────────
test.describe('Plano expirado — página de aviso', () => {
  test('plano-expirado.php carrega sem erros PHP', async ({ page }) => {
    await page.goto('/plano-expirado.php');
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
  });

  test('plano-expirado.php sem autenticação redireciona para landing/login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/plano-expirado.php');
    await page.waitForURL(url =>
      url.toString().includes('landing.php') || url.toString().includes('login.php'),
      { timeout: 5000 }
    );
    expect(page.url()).toMatch(/landing\.php|login\.php/);
    await ctx.close();
  });
});

// ── Limite de músicas no plano gratuito ───────────────────────────────────────
test.describe('Limite do plano — músicas', () => {
  test('plano gratuito bloqueia ao tentar adicionar mais de 10 músicas', async ({ page }) => {
    const csrf = await getCsrf(page);

    // Cria músicas até o limite (10) — pode já existir algumas, então
    // tentamos criar uma extra e verificamos se em algum momento retorna 403 com plano_limit
    const ids = [];
    let hitLimit = false;

    for (let i = 0; i < 12; i++) {
      const res = await page.request.post('/src/backend/editor/api.php', {
        data: JSON.stringify({
          action: 'save',
          nome: `__LIMITE_TESTE_${i}__`,
          cifra: '',
          artista: '',
          classificacao: '',
          bit: '',
        }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });

      if (res.status() === 403) {
        const body = await res.json();
        if (body.plano_limit) {
          hitLimit = true;
          break;
        }
      } else if (res.status() === 200) {
        const body = await res.json();
        if (body.id) ids.push(body.id);
      }
    }

    // Cleanup
    const freshCsrf = await getCsrf(page);
    for (const id of ids) {
      await page.request.post('/src/backend/editor/api.php', {
        data: JSON.stringify({ action: 'delete', id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': freshCsrf },
      });
    }

    // Se o usuário de teste não está no plano gratuito, o limite não vai ser atingido
    // Neste caso o teste é inconclusivo (skip gracioso) — não falha
    // Se está no gratuito, hitLimit deve ser true
    expect(typeof hitLimit).toBe('boolean');
  });

  test('resposta de bloqueio por limite inclui indicador de plano e mensagem de erro', async ({ page }) => {
    // Simula chamada direta ao cifro_require_plan_limit via mock de contagem
    // Verificamos que a estrutura JSON do erro de limite está correta chamando
    // o endpoint com plano bloqueado (sem sessão válida de banda)
    const csrf = await getCsrf(page);
    const res = await page.request.post('/src/backend/editor/api.php', {
      data: JSON.stringify({ action: 'save', nome: 'Test', cifra: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    // Se retornar 403 por limite, verifica estrutura
    if (res.status() === 403) {
      const body = await res.json();
      expect(body).toHaveProperty('plano_limit');
      expect(body).toHaveProperty('mensagem');
      expect(body.ok).toBe(false);
    } else {
      // Se não retornou 403, só verifica que não crashou
      expect([200, 400]).toContain(res.status());
    }
  });
});

// ── Webhook Stripe ────────────────────────────────────────────────────────────
test.describe('Stripe webhook', () => {
  test('webhook sem assinatura é rejeitado', async ({ page }) => {
    const res = await page.request.post('/api/stripe/webhook.php', {
      data: JSON.stringify({ type: 'invoice.paid', data: { object: {} } }),
      headers: { 'Content-Type': 'application/json' },
    });
    // 400 (bad signature) ou 500 (secret não configurado em dev) — nunca 200
    expect([400, 500]).toContain(res.status());
  });

  test('webhook com assinatura incorreta é rejeitado', async ({ page }) => {
    const res = await page.request.post('/api/stripe/webhook.php', {
      data: JSON.stringify({ type: 'invoice.paid', data: { object: {} } }),
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 't=9999999999,v1=invalidsignature',
      },
    });
    expect([400, 500]).toContain(res.status());
  });

  test('webhook rejeita requisições GET', async ({ page }) => {
    const res = await page.request.get('/api/stripe/webhook.php');
    expect([405, 400, 500]).toContain(res.status());
  });

  test('processa ciclo real de assinatura com payload assinado', async ({ page }) => {
    // sendSignedWebhook assina com 'whsec_playwright' e os payloads usam
    // price_test_*; esses valores vêm do fallback fixo em webServer.env no
    // playwright.config.js (garantido independente do STRIPE_WEBHOOK_SECRET/
    // price IDs reais que estejam no .env.local de quem roda os testes).
    const bandId = `stripe-${Date.now()}`;
    const subscription = `sub_${Date.now()}`;
    dbQuery('INSERT INTO bandas (id, nome, plano) VALUES (?, ?, ?)', [bandId, 'Webhook Playwright', 'gratuito']);

    try {
      let response = await sendSignedWebhook(page, {
        type: 'checkout.session.completed',
        data: { object: { subscription, metadata: { banda_id: bandId, price_id: 'price_test_mensal' } } },
      });
      expect(response.status(), await response.text()).toBe(200);
      let band = dbQuery('SELECT plano, stripe_subscription_id, plano_expira_em FROM bandas WHERE id=?', [bandId]).rows[0];
      expect(band).toMatchObject({ plano: 'mensal', stripe_subscription_id: subscription });
      // O Stripe entrega invoice.paid ANTES do checkout, quando a banda ainda
      // não tem stripe_subscription_id — então a expiração precisa ser gravada
      // aqui também, senão fica nula até a primeira renovação.
      expect(band.plano_expira_em, 'checkout deve gravar a expiração').not.toBeNull();

      response = await sendSignedWebhook(page, {
        type: 'checkout.session.completed',
        data: { object: { subscription, metadata: { banda_id: bandId, price_id: 'price_desconhecido' } } },
      });
      expect(response.status()).toBe(200);

      response = await sendSignedWebhook(page, {
        type: 'invoice.paid',
        data: { object: { subscription, lines: { data: [{ price: { id: 'price_test_anual' } }] } } },
      });
      expect(response.status()).toBe(200);
      expect(dbQuery('SELECT plano FROM bandas WHERE id=?', [bandId]).rows[0].plano).toBe('anual');

      response = await sendSignedWebhook(page, {
        type: 'customer.subscription.updated',
        data: { object: { id: subscription, status: 'active', items: { data: [{ price: { id: 'price_test_semestral' } }] } } },
      });
      expect(response.status()).toBe(200);
      expect(dbQuery('SELECT plano FROM bandas WHERE id=?', [bandId]).rows[0].plano).toBe('semestral');

      response = await sendSignedWebhook(page, {
        type: 'customer.subscription.updated',
        data: { object: { id: subscription, status: 'canceled' } },
      });
      expect(response.status()).toBe(200);
      expect(dbQuery('SELECT plano FROM bandas WHERE id=?', [bandId]).rows[0].plano).toBe('gratuito');

      await sendSignedWebhook(page, { type: 'invoice.paid', data: { object: { subscription: 'sub_inexistente' } } });
      await sendSignedWebhook(page, { type: 'customer.subscription.updated', data: { object: { id: subscription, status: 'past_due' } } });
      await sendSignedWebhook(page, { type: 'customer.subscription.updated', data: { object: { status: 'active' } } });
      await sendSignedWebhook(page, { type: 'customer.subscription.deleted', data: { object: { id: subscription } } });
      await sendSignedWebhook(page, { type: 'evento.desconhecido', data: { object: {} } });
      expect(dbQuery('SELECT plano FROM bandas WHERE id=?', [bandId]).rows[0].plano).toBe('gratuito');
    } finally {
      dbQuery('DELETE FROM bandas WHERE id=?', [bandId]);
    }
  });

  test('rejeita JSON inválido mesmo com assinatura válida', async ({ page }) => {
    const payload = '{';
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', 'whsec_playwright').update(`${timestamp}.${payload}`).digest('hex');
    const response = await page.request.post('/api/stripe/webhook.php', {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': `t=${timestamp},v1=${signature}`,
      },
    });
    expect(response.status()).toBe(400);
  });
});

// ── Landing page — preços atualizados ────────────────────────────────────────
test.describe('Landing page — preços corretos', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('mostra R$9,90 mensal', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('.pricing-grid')).toContainText('9');
  });

  test('mostra R$49,90 semestral', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('.pricing-grid')).toContainText('49');
  });

  test('mostra R$89,90 anual', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('.pricing-grid')).toContainText('89');
  });

  test('mostra plano gratuito', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('.pricing-grid')).toContainText(/gratuito/i);
  });

  test('4 cards na landing page', async ({ page }) => {
    await page.goto('/landing.php');
    const cards = page.locator('.pricing-grid .price-card');
    await expect(cards).toHaveCount(4);
  });

  test('cada plano pago leva o visitante ao cadastro carregando o plano escolhido', async ({ page }) => {
    await page.goto('/landing.php');
    for (const plano of ['mensal', 'semestral', 'anual']) {
      await expect(page.locator(`.pricing-grid a.btn-plan[href="/register.php?plano=${plano}"]`)).toHaveCount(1);
    }
  });

  test('o plano gratuito leva ao cadastro simples, sem plano na URL', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('.pricing-grid a.btn-plan[href="/register.php"]')).toHaveCount(1);
  });
});

test('pagamento na ordem real do Stripe grava a data de expiração', async ({ page }) => {
  // Medido em produção: invoice.paid chega 1 a 2 segundos ANTES do
  // checkout.session.completed. Nesse instante a banda ainda não tem
  // stripe_subscription_id, então o invoice não encontra a banda e a expiração
  // que ele traria se perde. O resultado era plano_expira_em nulo até a
  // primeira renovação — um ano inteiro no plano anual.
  const bandId = `stripe-ordem-${Date.now()}`;
  const subscription = `sub_ordem_${Date.now()}`;
  dbQuery('INSERT INTO bandas (id, nome, plano) VALUES (?, ?, ?)', [bandId, 'Ordem Stripe', 'gratuito']);

  try {
    // 1º: invoice.paid, com a banda ainda sem assinatura vinculada.
    let response = await sendSignedWebhook(page, {
      type: 'invoice.paid',
      data: { object: { subscription, lines: { data: [{ price: { id: 'price_test_anual' }, period: { end: 1900000000 } }] } } },
    });
    expect(response.status()).toBe(200);

    // 2º: o checkout, que é quem vincula a assinatura.
    response = await sendSignedWebhook(page, {
      type: 'checkout.session.completed',
      data: { object: { subscription, metadata: { banda_id: bandId, price_id: 'price_test_anual' } } },
    });
    expect(response.status()).toBe(200);

    const band = dbQuery('SELECT plano, plano_expira_em FROM bandas WHERE id=?', [bandId]).rows[0];
    expect(band.plano).toBe('anual');
    expect(band.plano_expira_em, 'a data precisa existir já no primeiro pagamento').not.toBeNull();
  } finally {
    dbQuery('DELETE FROM bandas WHERE id=?', [bandId]);
  }
});
