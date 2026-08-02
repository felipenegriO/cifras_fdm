/**
 * 12-planos.spec.js
 * Limites de plano — API de verificação de limites.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function getCsrf(page) {
  const res = await page.request.get('/api/csrf.php');
  const body = await res.json();
  return body.csrf_token || '';
}

test.describe('Limites de Plano', () => {
  test('API sync retorna plano da banda', async ({ page }) => {
    const res = await page.request.get('/api/sync/data.php');
    const body = await res.json();
    expect(['trial', 'gratuito', 'basico', 'banda', 'bloqueado', null]).toContain(body.plano);
  });

  test('plano-expirado.php carrega corretamente', async ({ page }) => {
    const res = await page.goto('/plano-expirado.php');
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
  });
});

test.describe('Webhook Stripe — endpoint', () => {
  test('webhook.php rejeita POST sem assinatura', async ({ page }) => {
    const res = await page.request.post('/api/stripe/webhook.php', {
      data: JSON.stringify({ type: 'invoice.paid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    // Deve rejeitar — 400/403/401 (assinatura inválida) ou 500 (secret não configurado em dev)
    expect([400, 403, 401, 500]).toContain(res.status());
  });
});
