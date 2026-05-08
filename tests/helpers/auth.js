import { expect } from '@playwright/test';

const LOGIN_PATH = '/login.php';
const TEST_USERNAME = process.env.TEST_USERNAME || 'felipe';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123';

export async function fazerLogin(page) {
  await page.goto(LOGIN_PATH);
  await page.fill('input[name="username"]', TEST_USERNAME);
  await page.fill('input[name="senha"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForLoadState('networkidle');

  const currentUrl = page.url();
  console.log('After login, current URL:', currentUrl);

  expect(currentUrl).not.toContain('login.php');
}
