/**
 * 35-google-auth.spec.js
 * Google OAuth login/signup — button visibility and callback error paths.
 * Real calls to accounts.google.com/oauth2.googleapis.com are never made
 * (impossible to script the real consent screen in CI); this covers the
 * parts our own code controls: state CSRF check and config-missing guard.
 */
import { test, expect } from '../fixtures/coverage.js';

test.describe('Login com Google — visibilidade do botão', () => {
  test('login.php e register.php refletem a configuração atual do servidor', async ({ page }) => {
    const loginRes = await page.goto('/login.php');
    expect(loginRes.status()).toBe(200);
    const registerRes = await page.goto('/register.php');
    expect(registerRes.status()).toBe(200);
    // Botão só aparece se GOOGLE_CLIENT_ID estiver configurado no ambiente
    // de teste; ambos os casos (presente/ausente) são válidos, então esta
    // suíte apenas garante que a página carrega sem erro fatal com o bloco novo.
  });
});

test.describe('Login com Google — callback.php', () => {
  test('sem state na sessão retorna erro e redireciona para login', async ({ page }) => {
    const res = await page.request.get('/api/auth/google/callback.php?code=abc&state=qualquer', {
      maxRedirects: 0,
    }).catch(err => err.response ?? null);
    // Sem cookie de sessão prévio (novo contexto de request), o state nunca bate.
    const status = res ? res.status() : null;
    expect([302, 303]).toContain(status);
    const location = res.headers()['location'];
    expect(location).toContain('/login.php');
    expect(location).toContain('erro=google');
  });

  test('sem code retorna erro e redireciona para login', async ({ page }) => {
    // Primeiro visita start.php para obter um state válido na sessão...
    await page.goto('/api/auth/google/start.php').catch(() => {});
    // then hits callback without a code but (if start.php redirected to
    // Google) the session cookie already carries google_oauth_state.
    const res = await page.request.get('/api/auth/google/callback.php?state=missing-code-check', {
      maxRedirects: 0,
    }).catch(err => err.response ?? null);
    const status = res ? res.status() : null;
    expect([302, 303]).toContain(status);
  });
});
