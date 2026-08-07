<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
// Already logged in → go to app
if (isset($_SESSION['autenticado']) && $_SESSION['autenticado'] === true) {
    header('Location: ' . base_url('/index.php')); exit;
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cifrô · Sua banda na mesma página. Sempre.</title>
  <meta name="description" content="Cifras, repertórios e modo ao vivo — tudo sincronizado, funciona offline. Comece grátis.">
  <script src="/src/js/cifro-theme.js"></script>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :root {
      --brand: #7c3aed;
      --brand-hover: #6d28d9;
      --bg: #0f0f0f;
      --bg-card: #1a1a1a;
      --border: #2a2a2a;
      --text: #f1f1f1;
      --text-2: #a0a0a0;
      --text-3: #666;
      --radius: 12px;
    }
    body { margin:0;padding:0;background:var(--bg);color:var(--text);font-family:'Inter',system-ui,sans-serif;line-height:1.6; }
    a { color:inherit;text-decoration:none; }
    img { max-width:100%; }

    /* ── NAV ── */
    nav { display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid var(--border);max-width:1100px;margin:0 auto; }
    .nav-brand { display:flex;align-items:center; }
    .nav-brand img { width:112px;height:auto;display:block; }
    .nav-links { display:flex;gap:12px;align-items:center; }
    .nav-link { padding:8px 16px;border-radius:8px;font-size:14px;color:var(--text-2); }
    .nav-link:hover { color:#fff;background:#1e1e1e; }
    .btn-nav { padding:8px 18px;background:var(--brand);color:#fff;border-radius:8px;font-size:14px;font-weight:600; }
    .btn-nav:hover { background:var(--brand-hover); }

    /* ── HERO ── */
    .hero { max-width:760px;margin:0 auto;padding:80px 24px 64px;text-align:center; }
    .hero-badge { display:inline-block;padding:5px 14px;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.3);border-radius:999px;font-size:13px;color:#a78bfa;margin-bottom:24px; }
    .hero h1 { font-size:clamp(32px,6vw,56px);font-weight:800;line-height:1.15;margin:0 0 18px;letter-spacing:-0.5px; }
    .hero h1 span { color:var(--brand); }
    .hero p { font-size:18px;color:var(--text-2);margin:0 0 36px;max-width:560px;margin-left:auto;margin-right:auto; }
    .cta-group { display:flex;gap:12px;justify-content:center;flex-wrap:wrap; }
    .btn-primary { padding:14px 28px;background:var(--brand);color:#fff;border-radius:10px;font-size:16px;font-weight:700;border:none;cursor:pointer;display:inline-block; }
    .btn-primary:hover { background:var(--brand-hover); }
    .btn-secondary { padding:14px 28px;background:transparent;color:var(--text-2);border-radius:10px;font-size:16px;font-weight:600;border:1px solid var(--border);cursor:pointer;display:inline-block; }
    .btn-secondary:hover { border-color:#555;color:#fff; }
    .hero-note { margin-top:18px;font-size:13px;color:var(--text-3); }

    /* ── PROOF ── */
    .proof { max-width:900px;margin:0 auto;padding:0 24px 72px; }
    .proof-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:24px; }
    .proof-card { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:28px 24px;text-align:center; }
    .proof-icon { font-size:32px;margin-bottom:12px; }
    .proof-title { font-size:16px;font-weight:700;margin-bottom:8px; }
    .proof-desc { font-size:14px;color:var(--text-2);line-height:1.5; }

    /* ── FEATURES ── */
    .features { max-width:900px;margin:0 auto;padding:0 24px 80px; }
    .section-title { text-align:center;font-size:28px;font-weight:700;margin-bottom:40px; }
    .features-grid { display:grid;grid-template-columns:repeat(2,1fr);gap:20px; }
    .feature-card { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:28px; }
    .feature-card h3 { margin:0 0 10px;font-size:17px; }
    .feature-card p { margin:0;font-size:14px;color:var(--text-2);line-height:1.55; }
    .feature-icon { font-size:28px;margin-bottom:14px; }

    /* ── PRICING ── */
    .pricing { max-width:960px;margin:0 auto;padding:0 24px 80px;text-align:center; }
    .pricing-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:40px; }
    .price-card { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:28px 20px;display:flex;flex-direction:column;position:relative; }
    .price-card.featured { border-color:rgba(124,58,237,.6);background:#1a1230; }
    .price-badge { position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--brand);color:#fff;font-size:11px;font-weight:700;padding:3px 12px;border-radius:999px;white-space:nowrap; }
    .price-name { font-size:14px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px; }
    .price-tag { font-size:36px;font-weight:800;color:#fff;line-height:1; }
    .price-tag span { font-size:15px;font-weight:400;color:var(--text-2); }
    .price-period { font-size:12px;color:var(--text-3);margin:6px 0 8px; }
    .price-economy { font-size:12px;color:#4ade80;font-weight:600;min-height:18px; }
    .price-divider { border:none;border-top:1px solid var(--border);margin:20px 0; }
    .price-features { list-style:none;padding:0;margin:0 0 24px;text-align:left;flex:1; }
    .price-features li { padding:5px 0;font-size:13px;color:var(--text-2); }
    .price-features li::before { content:'✓  ';color:var(--brand);font-weight:700; }
    .price-features li.limit { color:var(--text-3); }
    .price-features li.limit::before { content:'·  ';color:var(--text-3); }
    .btn-plan { display:block;width:100%;padding:10px;border-radius:8px;font-size:14px;font-weight:700;text-align:center;cursor:pointer; }
    .btn-plan-outline { background:transparent;border:1px solid var(--border);color:var(--text-2); }
    .btn-plan-outline:hover { border-color:#555;color:#fff; }
    .btn-plan-primary { background:var(--brand);color:#fff;border:none; }
    .btn-plan-primary:hover { background:var(--brand-hover); }
    @media (max-width:760px) { .pricing-grid { grid-template-columns:1fr 1fr; } }
    @media (max-width:480px) { .pricing-grid { grid-template-columns:1fr; } }

    /* ── CTA FINAL ── */
    .final-cta { text-align:center;padding:0 24px 80px; }
    .final-cta h2 { font-size:32px;font-weight:800;margin-bottom:16px; }
    .final-cta p { color:var(--text-2);margin-bottom:28px; }

    /* ── FOOTER ── */
    footer { border-top:1px solid var(--border);padding:24px;text-align:center;font-size:13px;color:var(--text-3); }

    @media (max-width:640px) {
      .proof-grid { grid-template-columns:1fr; }
      .features-grid { grid-template-columns:1fr; }
      .nav-links .nav-link { display:none; }
    }
  </style>
</head>
<body>

  <!-- NAV -->
  <nav>
    <a href="/landing.php" class="nav-brand" aria-label="Cifrô"><img src="/src/images/cifro-logo.svg" alt="Cifrô"></a>
    <div class="nav-links">
      <a href="/login.php" class="nav-link">Entrar</a>
      <a href="/register.php" class="btn-nav">Testar grátis</a>
    </div>
  </nav>

  <!-- HERO -->
  <section class="hero">
    <div class="hero-badge">🎸 Plano grátis · Sem cartão</div>
    <h1>Sua banda na<br><span>mesma página.</span><br>Sempre.</h1>
    <p>Cifras, repertórios e modo ao vivo — tudo sincronizado, funciona offline. Chega de "qual tom mesmo?"</p>
    <div class="cta-group">
      <a href="/register.php" class="btn-primary">Criar conta grátis</a>
      <a href="/login.php" class="btn-secondary">Já tenho conta</a>
    </div>
    <p class="hero-note">1 banda · até 10 músicas · faça upgrade quando quiser</p>
  </section>

  <!-- PROOF OF VALUE -->
  <section class="proof">
    <div class="proof-grid">
      <div class="proof-card">
        <div class="proof-icon">🎵</div>
        <div class="proof-title">Cifras com acordes coloridos</div>
        <div class="proof-desc">Transposição automática, letras alinhadas, fonte grande para o palco.</div>
      </div>
      <div class="proof-card">
        <div class="proof-icon">📋</div>
        <div class="proof-title">Repertórios por data</div>
        <div class="proof-desc">A banda toca no tom certo, na ordem certa. Sem papel, sem confusão.</div>
      </div>
      <div class="proof-card">
        <div class="proof-icon">📡</div>
        <div class="proof-title">Modo ao vivo</div>
        <div class="proof-desc">O líder muda a música e todos seguem na tela, em tempo real.</div>
      </div>
    </div>
  </section>

  <!-- FEATURES -->
  <section class="features">
    <h2 class="section-title">Tudo que sua banda precisa</h2>
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon">🌙</div>
        <h3>Modo escuro e fonte grande</h3>
        <p>Tela otimizada para o palco. Fundo preto, fonte ajustável, sem distrações.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">✏️</div>
        <h3>Editor de cifras</h3>
        <p>Cria e edita cifras com preview em tempo real. Acordes detectados automaticamente.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">📶</div>
        <h3>Funciona offline</h3>
        <p>Sem internet no culto? Sem problema. Os dados ficam no seu dispositivo e sincronizam depois.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🎹</div>
        <h3>Ensaio com YouTube</h3>
        <p>Controle de pitch, loop A-B, velocidade variável — tudo para ensaiar antes de subir no palco.</p>
      </div>
    </div>
  </section>

  <!-- PRICING -->
  <section class="pricing">
    <h2 class="section-title">Planos simples, sem surpresas</h2>
    <p style="color:var(--text-2);margin:-24px 0 0;font-size:15px">Todos os planos pagos incluem membros, músicas e repertórios ilimitados.</p>

    <div class="pricing-grid">

      <!-- GRATUITO -->
      <div class="price-card">
        <div class="price-name">Gratuito</div>
        <div class="price-tag">R$0</div>
        <div class="price-period">para sempre</div>
        <div class="price-economy"></div>
        <hr class="price-divider">
        <ul class="price-features">
          <li class="limit">Até 10 músicas</li>
          <li class="limit">1 repertório</li>
          <li>Modo ao vivo</li>
          <li>Funciona offline</li>
          <li class="limit">Sem membros adicionais</li>
        </ul>
        <a href="/register.php" class="btn-plan btn-plan-outline">Começar grátis</a>
      </div>

      <!-- MENSAL -->
      <div class="price-card">
        <div class="price-name">Mensal</div>
        <div class="price-tag">R$9<span>,90/mês</span></div>
        <div class="price-period">cobrado mensalmente</div>
        <div class="price-economy"></div>
        <hr class="price-divider">
        <ul class="price-features">
          <li>Músicas ilimitadas</li>
          <li>Repertórios e roteiros</li>
          <li>Modo ao vivo</li>
          <li>Funciona offline</li>
          <li>Membros ilimitados</li>
        </ul>
        <a href="/register.php" class="btn-plan btn-plan-outline">Criar conta grátis</a>
      </div>

      <!-- SEMESTRAL -->
      <div class="price-card featured">
        <div class="price-badge">✦ Mais popular</div>
        <div class="price-name">Semestral</div>
        <div class="price-tag">R$49<span>,90/6 meses</span></div>
        <div class="price-period">≈ R$8,32/mês</div>
        <div class="price-economy">Economize R$9,50 vs mensal</div>
        <hr class="price-divider">
        <ul class="price-features">
          <li>Músicas ilimitadas</li>
          <li>Repertórios e roteiros</li>
          <li>Modo ao vivo</li>
          <li>Funciona offline</li>
          <li>Membros ilimitados</li>
        </ul>
        <a href="/register.php" class="btn-plan btn-plan-primary">Criar conta grátis</a>
      </div>

      <!-- ANUAL -->
      <div class="price-card">
        <div class="price-name">Anual</div>
        <div class="price-tag">R$89<span>,90/ano</span></div>
        <div class="price-period">≈ R$7,49/mês</div>
        <div class="price-economy">Economize R$28,90 vs mensal</div>
        <hr class="price-divider">
        <ul class="price-features">
          <li>Músicas ilimitadas</li>
          <li>Repertórios e roteiros</li>
          <li>Modo ao vivo</li>
          <li>Funciona offline</li>
          <li>Membros ilimitados</li>
        </ul>
        <a href="/register.php" class="btn-plan btn-plan-outline">Criar conta grátis</a>
      </div>

    </div>
    <p style="color:var(--text-3);font-size:13px;margin-top:24px">Comece no plano gratuito · Sem cartão de crédito</p>
  </section>

  <!-- FINAL CTA -->
  <section class="final-cta">
    <h2>Pronto para simplificar seus ensaios?</h2>
    <p>Crie sua conta em menos de 1 minuto. Sem cartão de crédito.</p>
    <a href="/register.php" class="btn-primary">Criar conta grátis</a>
  </section>

  <footer>
    Cifrô &nbsp;·&nbsp; <a href="mailto:contato@cifro.online" style="color:var(--text-3)">contato@cifro.online</a>
    &nbsp;·&nbsp; <a href="<?= htmlspecialchars((string)env('TERMS_URL', '/termos.php')) ?>" style="color:var(--text-3)">Termos de Uso</a>
    &nbsp;·&nbsp; <a href="<?= htmlspecialchars((string)env('PRIVACY_URL', '/privacidade.php')) ?>" style="color:var(--text-3)">Política de Privacidade</a>
  </footer>

</body>
</html>
