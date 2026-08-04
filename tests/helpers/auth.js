import { expect } from '@playwright/test';

const LOGIN_PATH = '/login.php';
export const TEST_EMAIL = requiredTestEnv('TEST_EMAIL');
export const TEST_PASSWORD = requiredTestEnv('TEST_PASSWORD');

export function requiredTestEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} é obrigatório para executar os testes E2E.`);
  return value;
}

export async function fazerLogin(page) {
  await page.goto('/index.php', { waitUntil: 'domcontentloaded' });
  if (!page.url().includes('login.php') && !page.url().includes('landing.php')) {
    return;
  }

  await page.goto(LOGIN_PATH, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', TEST_EMAIL);
  await page.fill('input[name="senha"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('login.php'), { timeout: 10000 });
  expect(page.url()).not.toContain('login.php');
}
