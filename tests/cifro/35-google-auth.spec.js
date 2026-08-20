/**
 * 35-google-auth.spec.js
 * Google OAuth login/signup — button visibility and callback error paths.
 * Real calls to accounts.google.com/oauth2.googleapis.com are never made
 * (impossible to script the real consent screen in CI); this covers the
 * parts our own code controls: state CSRF check and config-missing guard.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '../fixtures/coverage.js';
import { dbQuery } from '../helpers/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Mirrors bootstrap.php's google_oauth_configured(): the button only renders
 * when GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI are all
 * non-empty. Reads the same .env/.env.local files the PHP app loads so this
 * test's expectation always matches whatever this environment is actually
 * configured with, instead of hardcoding presence/absence.
 */
function readEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (value.startsWith('"') || value.startsWith("'")) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

function isGoogleOauthConfiguredInEnv() {
  const repoRoot = path.resolve(__dirname, '../..');
  const merged = {
    ...readEnvFile(path.join(repoRoot, '.env')),
    ...readEnvFile(path.join(repoRoot, '.env.local')),
  };
  return ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI']
    .every((key) => (merged[key] ?? '').trim() !== '');
}

const envLocalPath = path.resolve(__dirname, '../../.env.local');
const GOOGLE_LOG_REFERENCE = 'api/auth/google/callback.php';

function googleLogCheckpoint() {
  return Number(dbQuery('SELECT COALESCE(MAX(id), 0) AS id FROM app_error_logs').rows[0].id);
}

function googleLogAfter(id) {
  return dbQuery(
    'SELECT id, nivel, descricao, detalhes FROM app_error_logs WHERE referencia = ? AND id > ? ORDER BY id DESC LIMIT 1',
    [GOOGLE_LOG_REFERENCE, id],
  ).rows[0];
}

function removeGoogleLog(id) {
  if (id) dbQuery('DELETE FROM app_error_logs WHERE id = ?', [id]);
}

/**
 * Temporarily appends extra vars to the real .env.local (also used for
 * DB_HOST etc.) so the PHP built-in server (single Playwright worker, tests
 * run serially) picks up different env() values on the next request, then
 * restores the original file content exactly. Never overwrites — only
 * appends and restores.
 */
async function withExtraEnv(extraVars, run) {
  const original = fs.readFileSync(envLocalPath, 'utf8');
  const extra = Object.entries(extraVars).map(([k, v]) => `${k}=${v}`).join('\n');
  fs.writeFileSync(envLocalPath, `${original}\n${extra}\n`);
  try {
    await run();
  } finally {
    fs.writeFileSync(envLocalPath, original);
  }
}

test.describe('Login com Google — visibilidade do botão', () => {
  test('login.php e register.php refletem a configuração atual do servidor', async ({ browser }) => {
    const configured = isGoogleOauthConfiguredInEnv();
    // Usa contexto anônimo — login.php e register.php redirecionam usuários já autenticados
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();

    const loginRes = await page.goto('/login.php');
    expect(loginRes.status()).toBe(200);
    const googleButton = 'a[href="/api/auth/google/start.php"]';
    if (configured) {
      await expect(page.locator(googleButton)).toBeVisible();
    } else {
      await expect(page.locator(googleButton)).toHaveCount(0);
    }

    const registerRes = await page.goto('/register.php');
    expect(registerRes.status()).toBe(200);
    // register.php usa href com ?source=register — seletor mais flexível
    const googleButtonRegister = 'a[href^="/api/auth/google/start.php"]';
    if (configured) {
      await expect(page.locator(googleButtonRegister)).toBeVisible();
    } else {
      await expect(page.locator(googleButtonRegister)).toHaveCount(0);
    }

    await ctx.close();
  });

  test('botão de login com Google está com link correto quando configurado', async ({ page }) => {
    const configured = isGoogleOauthConfiguredInEnv();
    if (!configured) {
      test.skip();
      return;
    }
    await page.goto('/login.php');
    const btn = page.locator('a[href="/api/auth/google/start.php"]').first();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('href', '/api/auth/google/start.php');
    // Botão deve ter texto reconhecível
    const text = await btn.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('início do login com Google redireciona para o Google quando configurado', async ({ page }) => {
    const configured = isGoogleOauthConfiguredInEnv();
    if (!configured) {
      test.skip();
      return;
    }
    // start.php deve redirecionar para o Google (302)
    const res = await page.request.get('/api/auth/google/start.php', { maxRedirects: 0 })
      .catch(err => err.response ?? null);
    const status = res?.status();
    expect([302, 303]).toContain(status);
    const location = res?.headers()['location'] ?? '';
    expect(location).toMatch(/accounts\.google\.com|google\.com/);
  });
});

test.describe('Login com Google — callback.php', () => {
  test('sem state na sessão retorna erro e redireciona para login', async ({ page }) => {
    const checkpoint = googleLogCheckpoint();
    const res = await page.request.get('/api/auth/google/callback.php?code=abc&state=qualquer', {
      maxRedirects: 0,
    }).catch(err => err.response ?? null);
    // Sem cookie de sessão prévio (novo contexto de request), o state nunca bate.
    const status = res ? res.status() : null;
    expect([302, 303]).toContain(status);
    const location = res.headers()['location'];
    expect(location).toContain('/login.php');
    expect(location).toContain('erro=google');
    const log = googleLogAfter(checkpoint);
    expect(log).toBeTruthy();
    expect(log.nivel).toBe('warning');
    const details = JSON.parse(log.detalhes);
    expect(details.exception).toBe('GoogleOAuthStateMismatch');
    expect(details.message).toContain('State OAuth');
    expect(details.reason).toBe('state_mismatch');
    expect(details.has_code).toBe(true);
    expect(details).not.toHaveProperty('code');
    expect(details).not.toHaveProperty('state');
    removeGoogleLog(log.id);
  });

  test('sem code retorna erro e redireciona para login', async ({ page }) => {
    await withExtraEnv(fakeGoogleEnv, async () => {
      const checkpoint = googleLogCheckpoint();
      const state = await goToStartAndCaptureState(page);
      expect(state).not.toBeNull();
      const res = await page.request.get(`/api/auth/google/callback.php?state=${encodeURIComponent(state)}`, {
        maxRedirects: 0,
      }).catch(err => err.response ?? null);
      const status = res ? res.status() : null;
      expect([302, 303]).toContain(status);
      const log = googleLogAfter(checkpoint);
      const details = JSON.parse(log.detalhes);
      expect(log.nivel).toBe('warning');
      expect(details.exception).toBe('GoogleOAuthMissingCode');
      expect(details.reason).toBe('missing_code');
      removeGoogleLog(log.id);
    });
  });

  async function goToStartAndCaptureState(page) {
    // Follows start.php's redirect URL (which encodes the "state" param
    // Google would echo back) so we can round-trip the exact same state
    // the session stored, letting the callback's isStateValid() pass.
    const startRes = await page.request.get('/api/auth/google/start.php', { maxRedirects: 0 }).catch(err => err.response ?? null);
    if (!startRes || ![302, 303].includes(startRes.status())) return null;
    const location = startRes.headers()['location'] || '';
    const match = location.match(/[?&]state=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  // start.php only sets $_SESSION['google_oauth_state'] (needed for the
  // callback's CSRF check) when google_oauth_configured() is true. This
  // environment normally has no GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI, so we
  // temporarily provide fake-but-well-formed ones (never hitting the real
  // Google endpoints — these tests never reach the token exchange).
  const fakeGoogleEnv = {
    GOOGLE_CLIENT_ID: 'playwright-fake-client-id.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'playwright-fake-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:8091/api/auth/google/callback.php',
  };

  test('usuário cancela o consentimento (error=access_denied) retorna erro e redireciona', async ({ page }) => {
    await withExtraEnv(fakeGoogleEnv, async () => {
      const checkpoint = googleLogCheckpoint();
      const state = await goToStartAndCaptureState(page);
      expect(state).not.toBeNull();
      const res = await page.request.get(`/api/auth/google/callback.php?state=${encodeURIComponent(state)}&error=access_denied`, {
        maxRedirects: 0,
      }).catch(err => err.response ?? null);
      const status = res ? res.status() : null;
      expect([302, 303]).toContain(status);
      expect(res.headers()['location']).toContain('erro=google');
      const log = googleLogAfter(checkpoint);
      const details = JSON.parse(log.detalhes);
      expect(log.nivel).toBe('warning');
      expect(details.exception).toBe('GoogleOAuthUserCancelled');
      expect(details.provider_error).toBe('access_denied');
      removeGoogleLog(log.id);
    });
  });

  test('code e state válidos, mas troca real do código com o Google falha, retorna erro', async ({ page }) => {
    await withExtraEnv(fakeGoogleEnv, async () => {
      const checkpoint = googleLogCheckpoint();
      const state = await goToStartAndCaptureState(page);
      expect(state).not.toBeNull();
      const res = await page.request.get(`/api/auth/google/callback.php?state=${encodeURIComponent(state)}&code=algum-codigo-de-teste`, {
        maxRedirects: 0,
      }).catch(err => err.response ?? null);
      const status = res ? res.status() : null;
      expect([302, 303]).toContain(status);
      // Com credenciais falsas (mas bem formadas), isConfigured() é true e o
      // fluxo chega até exchangeCodeForIdToken(), que falha ao tentar trocar
      // o código com o Google real — exercitando o catch(Throwable) e o
      // redirecionamento de erro, sem nunca completar um login real.
      expect(res.headers()['location']).toContain('erro=google');
      const log = googleLogAfter(checkpoint);
      const details = JSON.parse(log.detalhes);
      expect(log.nivel).toBe('error');
      expect(details.reason).toBe('authentication_failure');
      expect(details.exception).toBeTruthy();
      expect(details.message).toBeTruthy();
      expect(details.request_id).toMatch(/^[a-f0-9]{16}$/);
      removeGoogleLog(log.id);
    });
  });
});
