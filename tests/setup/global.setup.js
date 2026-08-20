/**
 * global.setup.js
 * Faz login uma vez e salva o estado de autenticação para todos os testes.
 * Também garante que existam usuários de teste com perfis específicos na banda padrão.
 */
import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'node:crypto';
import { limparResiduoDeExecucoesAnteriores } from './limpar-residuo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE        = path.join(__dirname, '../.auth/user.json');
const AUTH_GESTOR_FILE = path.join(__dirname, '../.auth/gestor.json');
const AUTH_BASICO_FILE = path.join(__dirname, '../.auth/basico.json');
const AUTH_EXTERNO_FILE = path.join(__dirname, '../.auth/externo.json');
const AUTH_PAID_ADMIN_FILE = path.join(__dirname, '../.auth/paid-admin.json');
const RUN_FILE = path.join(__dirname, '../.auth/run.json');

const EMAIL = requiredEnv('TEST_EMAIL');
const PASSWORD = requiredEnv('TEST_PASSWORD');
const RUN_ID = (process.env.E2E_RUN_ID || `${Date.now()}-${process.pid}`).replace(/[^a-zA-Z0-9-]/g, '');
const PROFILE_PASSWORD = randomBytes(18).toString('base64url');
const GESTOR_EMAIL = `gestor-${RUN_ID}@e2e.local`;
const BASICO_EMAIL = `basico-${RUN_ID}@e2e.local`;
const EXTERNO_EMAIL = `externo-${RUN_ID}@e2e.local`;
const PAID_ADMIN_EMAIL = `paid-admin-${RUN_ID}@e2e.local`;
const DEFAULT_BAND_ID = '00000000-0000-4000-8000-000000000002';

// ─── Login principal (administrador/master) ───────────────────────────────────
setup('autenticar e salvar estado', async ({ page, browser }) => {
  // Antes de qualquer coisa: devolve o banco ao estado do seed. Sem isto, as
  // bandas criadas e não removidas por execuções anteriores se acumulam, e o
  // select-banda.php mais abaixo passa a procurar um card no meio de dezenas.
  limparResiduoDeExecucoesAnteriores();

  await page.goto('/login.php');
  await expect(page.locator('#loginForm')).toBeVisible();

  await page.fill('#email', EMAIL);
  await page.fill('#senha', PASSWORD);
  await page.click('button[type="submit"]');

  // Garante que está autenticado — topnav ou select-banda devem aparecer
  await expect(page.locator('nav.topnav, .select-banda-container, .index-container').first()).toBeVisible({ timeout: 10000 });

  await selectDefaultBand(page);

  await writeStorageState(page.context(), AUTH_FILE);
  await fs.writeFile(RUN_FILE, JSON.stringify({ emails: [GESTOR_EMAIL, BASICO_EMAIL, EXTERNO_EMAIL, PAID_ADMIN_EMAIL] }), 'utf8');

  // ─── Provisionar usuários de teste para outros perfis ───────────────────────
  await provisionarUsuarioPerfil(page, {
    email: GESTOR_EMAIL,
    nome: 'Test Gestor',
    bandaPerfil: 'gestor',
    authFile: AUTH_GESTOR_FILE,
    browser,
  });

  await provisionarUsuarioPerfil(page, {
    email: BASICO_EMAIL,
    nome: 'Test Basico',
    bandaPerfil: 'basico',
    authFile: AUTH_BASICO_FILE,
    browser,
  });

  await provisionarUsuarioPerfil(page, {
    email: EXTERNO_EMAIL,
    nome: 'Test Externo',
    bandaPerfil: 'externo',
    authFile: AUTH_EXTERNO_FILE,
    browser,
  });

  await provisionarUsuarioPerfil(page, {
    email: PAID_ADMIN_EMAIL,
    nome: 'Test Paid Admin',
    bandaPerfil: 'administrador',
    authFile: AUTH_PAID_ADMIN_FILE,
    browser,
  });
});

async function provisionarUsuarioPerfil(adminPage, { email, nome, bandaPerfil, authFile, browser }) {
  // 1. Obter CSRF
  const csrfRes = await adminPage.request.get('/api/csrf.php');
  const { csrf_token } = await csrfRes.json();

  // 2. Criar/atualizar usuário via API de admin
  const saveRes = await adminPage.request.post('/src/backend/users/salvar_user.php', {
    data: JSON.stringify({
      nome,
      email,
      ativo: true,
      bandaPerfil,
      validade: '',
      _senhaPlain: PROFILE_PASSWORD,
    }),
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf_token,
    },
  });

  const saveBody = await saveRes.json().catch(() => ({}));

  if (!saveBody.sucesso && !saveBody.mensagem?.includes('já está em uso')) {
    console.warn(`[setup] Aviso ao provisionar ${email}:`, saveBody.mensagem ?? saveRes.status());
  }

  // 3. Fazer login com esse usuário e salvar estado
  const ctx = await browser.newContext();
  const p = await ctx.newPage();

  try {
    await p.goto('/login.php');
    await p.fill('#email', email);
    await p.fill('#senha', PROFILE_PASSWORD);
    await p.click('button[type="submit"]');

    await expect(p.locator('nav.topnav, .select-banda-container, .index-container').first()).toBeVisible({ timeout: 10000 });

    await selectDefaultBand(p);
    await definirPreferenciaDeCapotraste(p);

    await writeStorageState(ctx, authFile);
  } catch (e) {
    console.warn(`[setup] Falha ao logar como ${email}:`, e.message);
    // Salva estado vazio para que os testes possam detectar e pular
    await writeStorageState(ctx, authFile);
  } finally {
    await ctx.close();
  }
}

/**
 * Sem isto, o modal de primeiro acesso do capotraste abre na home e bloqueia o
 * clique na lista de músicas em todo teste que usar estes usuários. Só o spec
 * dedicado (74-capotraste) deve exercitar o primeiro acesso, e ele apaga a
 * preferência de propósito.
 */
async function definirPreferenciaDeCapotraste(page) {
  const csrf = await (await page.request.get('/api/csrf.php')).json();
  await page.request.post('/src/backend/users/salvar_config.php', {
    data: JSON.stringify({ config: { instrumento: 'violao', transposicaoPreferencia: 'cadastrado' } }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrf_token || '' },
  });
}

async function selectDefaultBand(page) {
  await page.goto('/select-banda.php');
  const card = page.locator(`.sb-card[data-band-id="${DEFAULT_BAND_ID}"]`);
  await expect(card).toBeVisible({ timeout: 8000 });
  await card.click();
  await page.waitForURL(/index\.php/i, { timeout: 8000 });
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} é obrigatório para executar os testes E2E.`);
  return value;
}

async function writeStorageState(context, target) {
  const state = await context.storageState();
  const temporary = `${target}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(temporary, JSON.stringify(state), 'utf8');
  await fs.rename(temporary, target);
}
