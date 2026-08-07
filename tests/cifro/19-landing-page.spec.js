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

  test('visitante recorrente ainda encontra "Entrar" no menu do celular', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('nav .btn-nav').first()).toBeVisible();
    await expect(page.locator('nav a[href="/login.php"]').first()).toBeVisible();
  });

  test('nenhum botão de ação fica menor que o alvo de toque de 44px', async ({ page }) => {
    await page.goto('/landing.php');
    const pequenos = await page.evaluate(() => {
      const sel = 'nav a, .footer-nav a, .btn-primary, .btn-secondary, .btn-plan, .faq summary';
      return [...document.querySelectorAll(sel)]
        .map(el => ({ texto: el.innerText.trim().slice(0, 24), altura: el.getBoundingClientRect().height }))
        .filter(item => item.altura > 0 && item.altura < 44);
    });
    expect(pequenos).toEqual([]);
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

// ── Promessas do produto batem com o que o sistema faz ────────────────────────
test.describe('Landing page — honestidade das promessas', () => {
  test('a página avisa que o modo ao vivo depende de internet', async ({ page }) => {
    await page.goto('/landing.php');
    // O modo ao vivo faz polling em /api/live/status.php — sem rede ele não funciona.
    // Prometer "ao vivo offline" seria propaganda enganosa.
    await expect(page.locator('main')).toContainText(/precisa de internet/i);
    const semInternet = page.locator('.truth-no');
    await expect(semInternet).toContainText(/ao vivo/i);
    await expect(semInternet).toContainText(/youtube/i);
  });

  test('a página separa o que abre offline do que não abre', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('.truth-yes')).toContainText(/cifras/i);
    await expect(page.locator('.truth-yes')).toContainText(/repert/i);
  });

  test('os limites do plano gratuito conferem com os do backend', async ({ page }) => {
    await page.goto('/landing.php');
    // cifro_plan_limits('gratuito') = 10 músicas, 1 playlist, 1 usuário, 1 banda
    const gratuito = page.locator('.pricing-grid .price-card').first();
    await expect(gratuito).toContainText(/10 músicas/i);
    await expect(gratuito).toContainText(/1 repertório/i);
  });

  test('a promessa de cancelamento distingue cartão de Pix, como o sistema faz', async ({ page }) => {
    await page.goto('/landing.php');
    const corpo = await page.locator('main').textContent();
    // Cartão: POST /api/plano/cancelar.php agenda cancel_at_period_end no Stripe.
    // Pix: não há assinatura recorrente, então não existe o que cancelar.
    // A copy não pode achatar os dois casos numa promessa só.
    expect(corpo).toMatch(/sem multa e sem fidelidade|sem multa/i);
    expect(corpo).toMatch(/cancelar assinatura/i);
    expect(corpo).toMatch(/pix/i);
    expect(corpo).toMatch(/at[ée] o fim do per[íi]odo/i);
  });

  test('a tela de plano existe e é o caminho que a landing indica para cancelar', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    const res = await page.goto('/plano.php');
    expect(res.status()).toBe(200);
    // O bloco "Solicitar cancelamento" só renderiza para plano pago (`$isPago`);
    // a cobertura do texto em si fica no teste de unidade de PlanoViewModel.
    await expect(page.locator('.plan-free-row')).toContainText(/plano gratuito/i);
    await ctx.close();
  });

  test('não promete prova social que ainda não existe', async ({ page }) => {
    await page.goto('/landing.php');
    const corpo = await page.locator('main').textContent();
    expect(corpo).not.toMatch(/milhares de|centenas de bandas|mais de \d+ ?mil/i);
  });
});

// ── Descoberta: SEO e compartilhamento ────────────────────────────────────────
test.describe('Landing page — SEO e compartilhamento', () => {
  test('tem imagem e título de compartilhamento (Open Graph)', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  });

  test('a imagem de compartilhamento existe de verdade', async ({ page }) => {
    const res = await page.request.get('/og-image.png');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  });

  test('tem canonical, manifest e favicon', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
    await expect(page.locator('link[rel="icon"]').first()).toHaveCount(1);
  });

  test('publica dados estruturados de aplicativo com os preços reais', async ({ page }) => {
    await page.goto('/landing.php');
    const bruto = await page.locator('script[type="application/ld+json"]').textContent();
    const dados = JSON.parse(bruto);
    expect(dados['@type']).toBe('SoftwareApplication');
    const precos = dados.offers.map(o => o.price);
    expect(precos).toEqual(['0', '9.90', '49.90', '89.90']);
  });

  test('robots.txt e sitemap.xml respondem', async ({ page }) => {
    const robots = await page.request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain('Sitemap:');

    const sitemap = await page.request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain('<urlset');
  });
});

// ── Seções novas ──────────────────────────────────────────────────────────────
test.describe('Landing page — seções de apoio à decisão', () => {
  test('explica como funciona em 3 passos', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('#como-funciona .step')).toHaveCount(3);
  });

  test('responde as objeções principais na FAQ', async ({ page }) => {
    await page.goto('/landing.php');
    const faq = page.locator('.faq');
    await expect(faq).toContainText(/cancelar/i);
    await expect(faq).toContainText(/digitar todas as minhas cifras/i);
    await expect(faq).toContainText(/precisa pagar/i);
    await expect(faq).toContainText(/dados/i);
  });

  test('abrir uma pergunta da FAQ revela a resposta', async ({ page }) => {
    await page.goto('/landing.php');
    const primeira = page.locator('.faq details').first();
    await expect(primeira.locator('p')).toBeHidden();
    await primeira.locator('summary').click();
    await expect(primeira.locator('p')).toBeVisible();
  });

  test('links do menu levam às âncoras de preço e de como funciona', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('#precos')).toHaveCount(1);
    await expect(page.locator('#como-funciona')).toHaveCount(1);
    await page.locator('nav a[href="#precos"]').click();
    await expect(page).toHaveURL(/#precos$/);
  });
});

// ── Funil de assinatura ───────────────────────────────────────────────────────
test.describe('Landing page — intenção de plano pago', () => {
  for (const plano of ['mensal', 'semestral', 'anual']) {
    test(`clicar em assinar ${plano} carrega a escolha até o cadastro`, async ({ page }) => {
      await page.goto('/landing.php');
      const botao = page.locator(`.pricing-grid a.btn-plan[href="/register.php?plano=${plano}"]`);
      await expect(botao).toBeVisible();
      await botao.click();
      await page.waitForURL(`**/register.php?plano=${plano}`);
      // O cadastro precisa reconhecer a escolha e deixar claro que nada é cobrado agora
      await expect(page.locator('body')).toContainText(/nada é cobrado agora/i);
    });
  }

  test('o plano gratuito continua indo para o cadastro simples', async ({ page }) => {
    await page.goto('/landing.php');
    await page.locator('.pricing-grid a.btn-plan[href="/register.php"]').first().click();
    await page.waitForURL('**/register.php');
    expect(page.url()).not.toContain('plano=');
  });
});

// ── Retorno após exclusão de conta ────────────────────────────────────────────
test.describe('Landing page — retorno do usuário', () => {
  test('confirma a exclusão quando o usuário volta de conta excluída', async ({ page }) => {
    await page.goto('/landing.php?conta_excluida=1');
    await expect(page.locator('.notice')).toBeVisible();
    await expect(page.locator('.notice')).toContainText(/exclu/i);
  });

  test('sem o parâmetro, nenhum aviso é exibido', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('.notice')).toHaveCount(0);
  });
});

// ── Acessibilidade ────────────────────────────────────────────────────────────
test.describe('Landing page — acessibilidade', () => {
  test('oferece link para pular direto ao conteúdo', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('.skip-link')).toHaveAttribute('href', '#conteudo');
    await expect(page.locator('#conteudo')).toHaveCount(1);
  });

  test('tem exatamente um H1 e nenhum título decorativo fora da hierarquia', async ({ page }) => {
    await page.goto('/landing.php');
    await expect(page.locator('h1')).toHaveCount(1);
    // Os cards de valor precisam ser títulos de verdade, não divs estilizadas
    await expect(page.locator('.proof-card h3')).toHaveCount(3);
  });

  test('todo texto atinge o contraste mínimo AA', async ({ page }) => {
    await page.goto('/landing.php');
    const reprovados = await page.evaluate(() => {
      const parse = c => { const n = c.match(/[\d.]+/g).map(Number); return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 }; };
      const over = (fg, bg) => ({ r: fg.a * fg.r + (1 - fg.a) * bg.r, g: fg.a * fg.g + (1 - fg.a) * bg.g, b: fg.a * fg.b + (1 - fg.a) * bg.b, a: 1 });
      const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const ratio = (f, b) => { const a = lum(f), c = lum(b); return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05); };
      const bgOf = el => {
        const pilha = []; let e = el;
        while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) pilha.push(c); if (c.a === 1) break; e = e.parentElement; }
        if (!pilha.length) return { r: 15, g: 15, b: 15, a: 1 };
        let acc = pilha.pop(); while (pilha.length) acc = over(pilha.pop(), acc); return acc;
      };
      const alvos = 'p,li,h1,h2,h3,a,summary,cite,td,th,.step-num,.price-tag,.price-period,.price-economy';
      return [...document.querySelectorAll(alvos)]
        .filter(el => el.textContent.trim() && getComputedStyle(el).display !== 'none')
        .map(el => {
          const cs = getComputedStyle(el);
          const tamanho = parseFloat(cs.fontSize);
          const grande = tamanho >= 24 || (tamanho >= 18.66 && parseInt(cs.fontWeight) >= 700);
          return { texto: el.textContent.trim().slice(0, 30), razao: +ratio(parse(cs.color), bgOf(el)).toFixed(2), minimo: grande ? 3 : 4.5 };
        })
        .filter(item => item.razao < item.minimo);
    });
    expect(reprovados).toEqual([]);
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
