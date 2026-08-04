/**
 * 19-landing-page.spec.js
 * Landing page — testa TODAS as ações, botões, links, seções e comportamentos.
 * Roda sem sessão autenticada (visitante).
 */
import { test, expect } from '../fixtures/coverage.js';

// Sem storageState — simula visitante não logado
test.use({ storageState: { cookies: [], origins: [] } });

// ── Carregamento básico ───────────────────────────────────────────────────────
test.describe('Landing page — carregamento', () => {
  test('GET /landing.php retorna 200', async ({ page }) => {
    const res = await page.goto('/landing.php');
    expect(res.status()).toBe(200);
  });

  test('título da página está correto', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page).toHaveTitle(/Cifrô/i);
  });

  test('página carrega sem erros JavaScript no console', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/landing.php');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('página não exibe "Fatal error" nem stack trace', async ({ page }) => {
    await page.goto('/landing.php');
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Parse error|Warning:|Notice:/i);
  });

  test('usuário autenticado é redirecionado para index.php', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    await page.goto('/landing.php');
    await page.waitForURL(url => url.toString().includes('index.php'), { timeout: 5000 });
    expect(page.url()).toContain('index.php');
    await ctx.close();
  });
});

// ── Navbar ────────────────────────────────────────────────────────────────────
test.describe('Landing page — navbar', () => {
  test('logo/brand está visível', async ({ page }) => {
    await page.goto('/landing.php');
    const brand = page.locator('nav .nav-brand, nav [class*="brand"]').first();
    await expect(brand).toBeVisible();
    await expect(brand.locator('img')).toHaveAttribute('alt', 'Cifrô');
  });

  test('botão "Entrar" está na nav e leva para login.php', async ({ page }) => {
    await page.goto('/landing.php');
    const entrarLink = page.locator('nav a[href="/login.php"]').first();
    await expect(entrarLink).toBeVisible();
    await expect(entrarLink).toContainText('Entrar');
    await entrarLink.click();
    await page.waitForURL('**/login.php');
    expect(page.url()).toContain('login.php');
  });

  test('botão "Testar grátis" na nav leva para register.php', async ({ page }) => {
    await page.goto('/landing.php');
    const registerLink = page.locator('nav a[href="/register.php"]').first();
    await expect(registerLink).toBeVisible();
    await registerLink.click();
    await page.waitForURL('**/register.php');
    expect(page.url()).toContain('register.php');
  });
});

// ── Hero ──────────────────────────────────────────────────────────────────────
test.describe('Landing page — hero', () => {
  test('headline principal está visível', async ({ page }) => {
    await page.goto('/landing.php');
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    const text = await h1.textContent();
    expect(text.length).toBeGreaterThan(5);
  });

  test('subtítulo/descrição está visível', async ({ page }) => {
    await page.goto('/landing.php');
    const hero = page.locator('.hero');
    await expect(hero).toBeVisible();
    const p = hero.locator('p').first();
    await expect(p).toBeVisible();
  });

  test('badge do plano grátis está visível', async ({ page }) => {
    await page.goto('/landing.php');
    const badge = page.locator('.hero-badge, [class*="badge"]').first();
    await expect(badge).toBeVisible();
    const text = await badge.textContent();
    expect(text).toMatch(/plano grátis/i);
  });

  test('botão primário de conta grátis leva para register.php', async ({ page }) => {
    await page.goto('/landing.php');
    // CTA principal no hero
    const ctaBtn = page.locator('.hero .btn-primary, .cta-group .btn-primary').first();
    await expect(ctaBtn).toBeVisible();
    await expect(ctaBtn).toContainText(/criar conta grátis/i);
    await ctaBtn.click();
    await page.waitForURL('**/register.php');
    expect(page.url()).toContain('register.php');
  });

  test('botão secundário "Já tenho conta" leva para login.php', async ({ page }) => {
    await page.goto('/landing.php');
    const secBtn = page.locator('.btn-secondary').first();
    await expect(secBtn).toBeVisible();
    await expect(secBtn).toContainText(/já tenho conta|entrar/i);
    await secBtn.click();
    await page.waitForURL('**/login.php');
    expect(page.url()).toContain('login.php');
  });

  test('nota de rodapé do hero menciona os limites gratuitos', async ({ page }) => {
    await page.goto('/landing.php');
    const note = page.locator('.hero-note').first();
    await expect(note).toBeVisible();
    const text = await note.textContent();
    expect(text).toMatch(/1 banda/i);
    expect(text).toMatch(/10 músicas/i);
  });
});

// ── Seção Proof of Value (3 cards) ────────────────────────────────────────────
test.describe('Landing page — proof of value', () => {
  test('3 cards de prova de valor estão visíveis', async ({ page }) => {
    await page.goto('/landing.php');
    const cards = page.locator('.proof-card');
    await expect(cards).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(cards.nth(i)).toBeVisible();
    }
  });

  test('card de cifras está presente', async ({ page }) => {
    await page.goto('/landing.php');
    const proof = page.locator('.proof');
    await expect(proof).toContainText(/cifra|acorde/i);
  });

  test('card de setlists está presente', async ({ page }) => {
    await page.goto('/landing.php');
    const proof = page.locator('.proof');
    await expect(proof).toContainText(/setlist|tom certo/i);
  });

  test('card de modo ao vivo está presente', async ({ page }) => {
    await page.goto('/landing.php');
    const proof = page.locator('.proof');
    await expect(proof).toContainText(/ao vivo|live|tempo real/i);
  });
});

// ── Seção Features (4 cards) ──────────────────────────────────────────────────
test.describe('Landing page — features', () => {
  test('seção de features está visível', async ({ page }) => {
    await page.goto('/landing.php');
    const features = page.locator('.features');
    await expect(features).toBeVisible();
  });

  test('4 feature cards estão presentes', async ({ page }) => {
    await page.goto('/landing.php');
    const cards = page.locator('.feature-card');
    await expect(cards).toHaveCount(4);
  });

  test('feature de modo escuro está presente', async ({ page }) => {
    await page.goto('/landing.php');
    const features = page.locator('.features');
    await expect(features).toContainText(/modo escuro|palco|fonte/i);
  });

  test('feature de editor de cifras está presente', async ({ page }) => {
    await page.goto('/landing.php');
    const features = page.locator('.features');
    await expect(features).toContainText(/editor|edita/i);
  });

  test('feature offline está presente', async ({ page }) => {
    await page.goto('/landing.php');
    const features = page.locator('.features');
    await expect(features).toContainText(/offline|sem internet/i);
  });

  test('feature de ensaio com YouTube está presente', async ({ page }) => {
    await page.goto('/landing.php');
    const features = page.locator('.features');
    await expect(features).toContainText(/youtube|ensaio|pitch/i);
  });
});

// ── Seção Pricing ─────────────────────────────────────────────────────────────
test.describe('Landing page — pricing', () => {
  test('seção de preço está visível', async ({ page }) => {
    await page.goto('/landing.php');
    const pricing = page.locator('.pricing');
    await expect(pricing).toBeVisible();
  });

  test('4 cards de planos estão exibidos', async ({ page }) => {
    await page.goto('/landing.php');
    const cards = page.locator('.pricing-grid .price-card');
    await expect(cards).toHaveCount(4);
  });

  test('preços R$9,90 / R$49,90 / R$89,90 estão exibidos', async ({ page }) => {
    await page.goto('/landing.php');
    const pricing = page.locator('.pricing');
    await expect(pricing).toContainText(/9/);   // R$9,90
    await expect(pricing).toContainText(/49/);  // R$49,90
    await expect(pricing).toContainText(/89/);  // R$89,90
  });

  test('plano gratuito está exibido', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('.pricing')).toContainText(/gratuito/i);
  });

  test('lista de benefícios está visível nos cards', async ({ page }) => {
    await page.goto('/landing.php');
    const features = page.locator('.price-card__features li, .price-features li');
    const count = await features.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('botão de upgrade no pricing leva para register.php', async ({ page }) => {
    await page.goto('/landing.php');
    const pricingBtn = page.locator('.pricing-grid a.btn-plan[href="/register.php"]').first();
    await expect(pricingBtn).toBeVisible();
    await pricingBtn.click();
    await page.waitForURL('**/register.php');
    expect(page.url()).toContain('register.php');
  });

  test('preço anual mencionado', async ({ page }) => {
    await page.goto('/landing.php');
    const pricing = page.locator('.pricing');
    await expect(pricing).toContainText(/ano/i);
  });
});

// ── Seção Final CTA ───────────────────────────────────────────────────────────
test.describe('Landing page — final CTA', () => {
  test('seção final CTA está visível', async ({ page }) => {
    await page.goto('/landing.php');
    const finalCta = page.locator('.final-cta');
    await expect(finalCta).toBeVisible();
  });

  test('botão "Criar conta grátis" leva para register.php', async ({ page }) => {
    await page.goto('/landing.php');
    const finalBtn = page.locator('.final-cta .btn-primary').first();
    await expect(finalBtn).toBeVisible();
    await expect(finalBtn).toContainText(/criar conta|grátis/i);
    await finalBtn.click();
    await page.waitForURL('**/register.php');
    expect(page.url()).toContain('register.php');
  });

  test('texto menciona "sem cartão"', async ({ page }) => {
    await page.goto('/landing.php');
    const finalCta = page.locator('.final-cta');
    await expect(finalCta).toContainText(/cartão/i);
  });
});

// ── Footer ────────────────────────────────────────────────────────────────────
test.describe('Landing page — footer', () => {
  test('footer está visível', async ({ page }) => {
    await page.goto('/landing.php');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('footer contém nome Cifrô', async ({ page }) => {
    await page.goto('/landing.php');
    const footer = page.locator('footer');
    await expect(footer).toContainText('Cifrô');
  });

  test('link de contato no footer tem href mailto', async ({ page }) => {
    await page.goto('/landing.php');
    const mailto = page.locator('footer a[href^="mailto:"]').first();
    await expect(mailto).toBeVisible();
    const href = await mailto.getAttribute('href');
    expect(href).toMatch(/^mailto:/);
  });
});

// ── Responsividade mobile ─────────────────────────────────────────────────────
test.describe('Landing page — mobile (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('página carrega sem overflow horizontal', async ({ page }) => {
    await page.goto('/landing.php');
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5); // tolerância de 5px
  });

  test('hero está visível no mobile', async ({ page }) => {
    await page.goto('/landing.php');
    const hero = page.locator('.hero');
    await expect(hero).toBeVisible();
  });

  test('botão primário do hero está clicável no mobile', async ({ page }) => {
    await page.goto('/landing.php');
    const ctaBtn = page.locator('.hero .btn-primary').first();
    await expect(ctaBtn).toBeVisible();
    await ctaBtn.click();
    await page.waitForURL('**/register.php');
    expect(page.url()).toContain('register.php');
  });

  test('nav-links se adapta ao mobile (links de texto ocultos via CSS)', async ({ page }) => {
    await page.goto('/landing.php');
    // Só o botão de CTA deve estar visível no mobile — nav-link é hidden via CSS
    const navBtn = page.locator('nav .btn-nav').first();
    await expect(navBtn).toBeVisible();
  });
});

// ── Navegação completa (fluxo do visitante) ───────────────────────────────────
test.describe('Landing page — fluxo completo do visitante', () => {
  test('visitante chega na landing → clica Entrar → vê login', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('h1').first()).toBeVisible();

    // Clica em "Entrar" na nav
    await page.locator('nav a[href="/login.php"]').first().click();
    await page.waitForURL('**/login.php');
    await expect(page.locator('body')).not.toContainText('Fatal error');
    // Página de login deve ter campo de usuário/senha
    const emailInput = page.locator('input[name="email"]').first();
    await expect(emailInput).toBeVisible();
  });

  test('visitante chega na landing → clica Testar grátis → vê registro', async ({ page }) => {
    await page.goto('/landing.php');

    // Clica no CTA principal do hero
    await page.locator('.hero .btn-primary').first().click();
    await page.waitForURL('**/register.php');
    await expect(page.locator('body')).not.toContainText('Fatal error');
    // Página de registro deve ter formulário
    const form = page.locator('form').first();
    await expect(form).toBeVisible();
  });

  test('visitante usa botão "Já tenho conta" → vê login', async ({ page }) => {
    await page.goto('/landing.php');
    await page.locator('.btn-secondary').first().click();
    await page.waitForURL('**/login.php');
    expect(page.url()).toContain('login.php');
  });

  test('visitante rola até pricing → clica CTA → vê registro', async ({ page }) => {
    await page.goto('/landing.php');
    await page.locator('.pricing').scrollIntoViewIfNeeded();
    const pricingBtn = page.locator('.pricing-grid a.btn-plan[href="/register.php"]').first();
    await pricingBtn.click();
    await page.waitForURL('**/register.php');
    expect(page.url()).toContain('register.php');
  });

  test('visitante rola até final CTA → clica → vê registro', async ({ page }) => {
    await page.goto('/landing.php');
    await page.locator('.final-cta').scrollIntoViewIfNeeded();
    await page.locator('.final-cta .btn-primary').first().click();
    await page.waitForURL('**/register.php');
    expect(page.url()).toContain('register.php');
  });
});

// ── Segurança e headers ───────────────────────────────────────────────────────
test.describe('Landing page — segurança', () => {
  test('tem header X-Content-Type-Options', async ({ page }) => {
    const res = await page.request.get('/landing.php');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('tem header X-Frame-Options', async ({ page }) => {
    const res = await page.request.get('/landing.php');
    expect(res.headers()['x-frame-options']?.toLowerCase()).toBe('sameorigin');
  });

  test('tem header Referrer-Policy', async ({ page }) => {
    const res = await page.request.get('/landing.php');
    expect(res.headers()['referrer-policy']).toBeTruthy();
  });

  test('não exibe informações sensíveis do servidor', async ({ page }) => {
    await page.goto('/landing.php');
    const html = await page.content();
    expect(html).not.toMatch(/DB_PASS|DB_USER|ENCRYPTION_KEY|mysqli_connect/i);
  });
});
