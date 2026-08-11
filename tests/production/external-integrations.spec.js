import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const external = process.env.E2E_EXTERNAL_REAL === 'true';

async function login(page) {
  const email = process.env.PROD_TEST_EMAIL?.trim();
  const password = process.env.PROD_TEST_PASSWORD?.trim();
  if (!email || !password) throw new Error('PROD_TEST_EMAIL e PROD_TEST_PASSWORD são obrigatórios.');
  await page.goto('login.php');
  await page.locator('#email').fill(email);
  await page.locator('#senha').fill(password);
  await page.getByRole('button', { name: /entrar/i }).click();
  if (page.url().includes('select-banda')) await page.locator('.sb-card').first().click();
  await expect(page).toHaveURL(/index\.php/);
}

test('Google OAuth real retorna autenticado para a aplicação', async ({ browser }) => {
  test.skip(!external, 'Defina E2E_EXTERNAL_REAL=true para integrações externas reais.');
  const state = process.env.E2E_GOOGLE_STORAGE_STATE?.trim();
  if (!state || !fs.existsSync(state)) throw new Error('E2E_GOOGLE_STORAGE_STATE deve apontar para uma sessão Google real.');
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  try {
    await page.goto(new URL('login.php', test.info().project.use.baseURL).toString());
    await page.getByRole('link', { name: /Continuar com Google/i }).click();
    const account = process.env.E2E_GOOGLE_EMAIL?.trim();
    if (account && page.url().includes('accounts.google.com')) {
      const choice = page.getByText(account, { exact: false }).first();
      if (await choice.isVisible().catch(() => false)) await choice.click();
      const continueButton = page.getByRole('button', { name: /continuar|continue|permitir|allow/i }).last();
      if (await continueButton.isVisible().catch(() => false)) await continueButton.click();
    }
    await expect(page).toHaveURL(/index\.php|select-banda\.php/, { timeout: 60000 });
    await expect(page.locator('nav.topnav, .select-banda-container').first()).toBeVisible();
  } finally {
    await context.close();
  }
});

test('checkout Stripe real em modo teste conclui e ativa o plano', async ({ page }) => {
  test.skip(!external || process.env.E2E_STRIPE_CHECKOUT_COMPLETE !== 'true', 'Checkout externo deve ser habilitado explicitamente.');
  await login(page);
  await page.goto('plano.php');
  await page.locator('.js-stripe-checkout[data-plan="anual"]').first().click();
  await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 30000 });
  const email = process.env.PROD_TEST_EMAIL?.trim();
  const fields = {
    'input[name="email"]': email,
    'input[name="cardNumber"]': '4242424242424242',
    'input[name="cardExpiry"]': '1234',
    'input[name="cardCvc"]': '123',
    'input[name="billingName"]': 'Cifro E2E',
  };
  for (const [selector, value] of Object.entries(fields)) {
    const input = page.locator(selector);
    if (await input.isVisible().catch(() => false)) await input.fill(value);
  }
  await page.getByRole('button', { name: /assinar|subscribe|pagar|pay/i }).last().click();
  await expect(page).toHaveURL(/plano\.php\?checkout=success/, { timeout: 90000 });
  await expect(page.locator('body')).toContainText(/plano atual|assinatura confirmada/i);
});
