import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '../fixtures/coverage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const waitlistDir = path.resolve(__dirname, '../../public/storage');
const waitlistFile = path.join(waitlistDir, 'waitlist.csv');
let originalWaitlist = null;
let hadWaitlist = false;

test.describe('PHP abaixo de 80% — waitlist', () => {
  test.beforeAll(() => {
    fs.mkdirSync(waitlistDir, { recursive: true });
    hadWaitlist = fs.existsSync(waitlistFile);
    originalWaitlist = hadWaitlist ? fs.readFileSync(waitlistFile) : null;
    fs.writeFileSync(waitlistFile, 'linha-invalida\n');
  });

  test.afterAll(() => {
    if (hadWaitlist) fs.writeFileSync(waitlistFile, originalWaitlist);
    else fs.rmSync(waitlistFile, { force: true });
  });

  test('rejeita método diferente de POST', async ({ request }) => {
    const response = await request.get('/api/waitlist.php');
    expect(response.status()).toBe(405);
    expect(await response.json()).toMatchObject({ success: false });
  });

  test('aceita formulário tradicional quando o corpo não é JSON', async ({ request }) => {
    const email = `form-${Date.now()}@cifro.test`;
    const response = await request.post('/api/waitlist.php', { form: { email } });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ success: true });
  });

  test('honeypot finge sucesso sem persistir', async ({ request }) => {
    const email = `bot-${Date.now()}@cifro.test`;
    const response = await request.post('/api/waitlist.php', {
      data: { email, website: 'https://spam.test' },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(fs.readFileSync(waitlistFile, 'utf8')).not.toContain(email);
  });

  for (const [name, email] of [
    ['ausente', undefined],
    ['vazio', ''],
    ['inválido', 'email-invalido'],
    ['longo', `${'a'.repeat(181)}@cifro.test`],
  ]) {
    test(`rejeita e-mail ${name}`, async ({ request }) => {
      const response = await request.post('/api/waitlist.php', { data: { email } });
      expect(response.status()).toBe(422);
      expect(await response.json()).toMatchObject({ success: false });
    });
  }

  test('persiste cadastro novo e trata duplicidade sem criar outra linha', async ({ request }) => {
    const email = `novo-${Date.now()}@cifro.test`;
    const first = await request.post('/api/waitlist.php', { data: { email } });
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ success: true });

    const duplicate = await request.post('/api/waitlist.php', { data: { email: email.toUpperCase() } });
    expect(duplicate.status()).toBe(200);
    expect(await duplicate.json()).toMatchObject({ success: true });

    const occurrences = fs.readFileSync(waitlistFile, 'utf8').toLowerCase().split(email.toLowerCase()).length - 1;
    expect(occurrences).toBe(1);
  });

  test('aplica limite de três cadastros recentes por IP', async ({ request }) => {
    fs.writeFileSync(waitlistFile, '');
    for (let index = 0; index < 3; index += 1) {
      const response = await request.post('/api/waitlist.php', {
        data: { email: `rate-${Date.now()}-${index}@cifro.test` },
      });
      expect(response.status()).toBe(200);
    }

    const blocked = await request.post('/api/waitlist.php', {
      data: { email: `rate-${Date.now()}-blocked@cifro.test` },
    });
    expect(blocked.status()).toBe(429);
    expect(await blocked.json()).toMatchObject({ success: false });
  });
});
