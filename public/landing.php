<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
// Already logged in → go to app
if (isset($_SESSION['autenticado']) && $_SESSION['autenticado'] === true) {
    header('Location: /index.php'); exit;
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>StageBox - Cifras · Sua banda na mesma página. Sempre.</title>
  <meta name="description" content="Cifras, setlists e modo ao vivo — tudo sincronizado, funciona offline. Experimente grátis por 30 dias.">
  <script src="/src/js/fdm-theme.js"></script>
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
    .nav-brand { font-size:18px;font-weight:700;color:#fff; }
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
    .pricing { max-width:560px;margin:0 auto;padding:0 24px 80px;text-align:center; }
    .price-card { background:var(--bg-card);border:1px solid rgba(124,58,237,.4);border-radius:var(--radius);padding:40px 32px; }
    .price-tag { font-size:48px;font-weight:800;color:#fff;margin:16px 0 4px; }
    .price-tag span { font-size:20px;font-weight:400;color:var(--text-2); }
    .price-note { color:var(--text-2);font-size:14px;margin-bottom:28px; }
    .price-features { list-style:none;padding:0;margin:0 0 28px;text-align:left;display:inline-block; }
    .price-features li { padding:6px 0;font-size:15px;color:var(--text-2); }
    .price-features li::before { content:'✓  ';color:var(--brand);font-weight:700; }

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
    <div class="nav-brand">StageBox <span style="color:var(--brand)">·</span> Cifras</div>
    <div class="nav-links">
      <a href="/login.php" class="nav-link">Entrar</a>
      <a href="/register.php" class="btn-nav">Testar grátis</a>
    </div>
  </nav>

  <!-- HERO -->
  <section class="hero">
    <div class="hero-badge">🎸 Grátis por 30 dias · Sem cartão</div>
    <h1>Sua banda na<br><span>mesma página.</span><br>Sempre.</h1>
    <p>Cifras, setlists e modo ao vivo — tudo sincronizado, funciona offline. Chega de "qual tom mesmo?"</p>
    <div class="cta-group">
      <a href="/register.php" class="btn-primary">Testar grátis por 30 dias</a>
      <a href="/login.php" class="btn-secondary">Já tenho conta</a>
    </div>
    <p class="hero-note">30 dias gratuitos · R$5/mês depois · Cancele quando quiser</p>
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
        <div class="proof-title">Setlists por data</div>
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
    <h2 class="section-title">Preço simples</h2>
    <div class="price-card">
      <p style="color:var(--text-2);margin:0">Para toda a banda</p>
      <div class="price-tag">R$5<span>/mês</span></div>
      <p class="price-note">ou R$50/ano (2 meses grátis)</p>
      <ul class="price-features">
        <li>Membros ilimitados na banda</li>
        <li>Músicas, setlists e roteiros ilimitados</li>
        <li>Modo ao vivo para todos</li>
        <li>Funciona offline</li>
        <li>Suporte por e-mail</li>
      </ul>
      <a href="/register.php" class="btn-primary" style="display:block;width:100%;text-align:center">
        Testar grátis por 30 dias
      </a>
    </div>
  </section>

  <!-- FINAL CTA -->
  <section class="final-cta">
    <h2>Pronto para simplificar seus ensaios?</h2>
    <p>Crie sua conta em menos de 1 minuto. Sem cartão de crédito.</p>
    <a href="/register.php" class="btn-primary">Criar conta grátis</a>
  </section>

  <footer>
    StageBox - Cifras &nbsp;·&nbsp; <a href="mailto:contato@stagebox.com.br" style="color:var(--text-3)">contato@stagebox.com.br</a>
  </footer>

</body>
</html>
