/**
 * global.setup.js
 * Faz login uma vez e salva o estado de autenticação para todos os testes.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE  = path.join(__dirname, '../.auth/user.json');

const USERNAME = process.env.TEST_USERNAME || 'felipe';
const PASSWORD = process.env.TEST_PASSWORD || '123';

setup('autenticar e salvar estado', async ({ page }) => {
  await page.goto('/login.php');
  await expect(page.locator('#loginForm')).toBeVisible();

  await page.fill('#username', USERNAME);
  await page.fill('#senha', PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForURL(url => !url.toString().includes('login.php'), { timeout: 10000 });

  // Garante que está autenticado — topnav ou select-banda devem aparecer
  await expect(page.locator('nav.topnav, .select-banda-container, .index-container').first()).toBeVisible({ timeout: 8000 });

  await page.context().storageState({ path: AUTH_FILE });
});
