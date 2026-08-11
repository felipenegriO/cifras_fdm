<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
// Already logged in → go to app
if (isset($_SESSION['autenticado']) && $_SESSION['autenticado'] === true) {
    header('Location: ' . base_url('/index.php')); exit;
}
// Página pública de marketing: pode ser cacheada por navegador/CDN
// (sobrescreve o no-store padrão que o bootstrap aplica ao resto do site).
if (!headers_sent()) {
    header('Cache-Control: public, max-age=300, s-maxage=3600');
}

$siteUrl   = rtrim((string) env('APP_URL', 'https://cifro.online'), '/');
$canonical = $siteUrl . '/';
$ogImage   = $siteUrl . '/og-image.png';
$gaId      = trim((string) env('GA4_MEASUREMENT_ID', ''));
$siteHost  = preg_replace('#^https?://#', '', $siteUrl);

$supportEmail = (string) env('SUPPORT_EMAIL', 'contato@cifro.online');
$whatsapp     = preg_replace('/\D+/', '', (string) env('PAYMENT_WHATSAPP_PHONE', ''));
$ownerName    = trim((string) env('OWNER_NAME', ''));
$ownerCity    = trim((string) env('OWNER_LOCATION', ''));

// Prova social só aparece quando é real e configurada. Sem env, a seção não existe.
$quote       = trim((string) env('SOCIAL_PROOF_QUOTE', ''));
$quoteAuthor = trim((string) env('SOCIAL_PROOF_AUTHOR', ''));

// Screenshots do produto: carrossel no hero. Cada capa real (.webp) que existir
// entra no lugar do mockup ilustrativo correspondente — sem precisar tocar no HTML.
$shotDir = __DIR__ . '/src/images/produto/';
$hasShot = static fn (string $f): bool => is_file($shotDir . $f);

$shotSlots = [
    ['file' => 'leitura.png',   'alt' => 'Tela de leitura do Cifrô com a cifra em tela cheia, acordes e letra em cores diferentes, fonte grande, fundo escuro e controle de tom ao lado — pronto pra tocar no palco.'],
    ['file' => 'editor.png',    'alt' => 'Editor do Cifrô com a cifra colada: acordes reconhecidos e destacados automaticamente acima da letra.'],
    ['file' => 'importar.png',  'alt' => 'Tela de importar cifra do Cifrô: cole o link do CifraClub e o conteúdo é buscado automaticamente.'],
];

$heroSlides = [];
foreach ($shotSlots as $slot) {
    if ($hasShot($slot['file'])) {
        $heroSlides[] = ['src' => '/src/images/produto/' . $slot['file'], 'alt' => $slot['alt'], 'mock' => false];
    }
}
$heroShotMock = $hasShot('cifra-palco-mock.svg');
if (!$heroSlides && $heroShotMock) {
    $heroSlides[] = ['src' => '/src/images/produto/cifra-palco-mock.svg', 'alt' => $shotSlots[0]['alt'], 'mock' => true];
}
$heroShot = count($heroSlides) > 0;
$heroIsMock = $heroShot && $heroSlides[0]['mock'];

$contaExcluida = isset($_GET['conta_excluida']);

// FAQ: array único, reaproveitado no HTML e no JSON-LD (FAQPage) abaixo.
$faqItems = [
    [
        'q' => 'Preciso digitar todas as minhas cifras à mão?',
        'a' => 'Você precisa trazer a cifra para dentro do Cifrô — colando o texto de onde ela estiver ou escrevendo no editor. O que você não precisa fazer é marcar acorde por acorde: o editor reconhece sozinho e já mostra o resultado formatado do lado. Depois de cadastrada, a música fica na biblioteca da banda para sempre e serve para todos os repertórios.',
    ],
    [
        'q' => 'Todo mundo da banda precisa pagar?',
        'a' => 'Não. O plano é da banda, não por pessoa. Um plano pago libera membros ilimitados — cada músico entra com o próprio login, sem custo adicional. No plano gratuito só você tem acesso.',
    ],
    [
        'q' => 'Posso cancelar quando quiser?',
        'a' => 'Sim, sem multa e sem fidelidade. Se você assinou no cartão, cancela sozinho: na tela de Plano tem o botão <strong>“Cancelar assinatura”</strong> e pronto — nenhuma nova cobrança é feita. Se você pagou por Pix não existe cobrança recorrente, então basta não renovar (e há um botão para avisar o suporte, se preferir). Nos dois casos você continua com o plano pago até o fim do período que já pagou, e depois a conta volta para o plano gratuito. Pelo Código de Defesa do Consumidor, você ainda tem 7 dias após a contratação para desistir e receber tudo de volta.',
    ],
    [
        'q' => 'Se eu cancelar ou parar de pagar, perco minhas cifras?',
        'a' => 'Não. A conta volta para os limites do plano gratuito, mas o conteúdo continua lá. Em Configurações você pode exportar seus dados a qualquer momento, com plano ativo ou não, e também pedir a exclusão definitiva da conta se quiser.',
    ],
    [
        'q' => 'Funciona mesmo sem internet?',
        'a' => 'As cifras e os repertórios, sim — o app se prepara sozinho para uso offline assim que você abre com conexão, sem precisar tocar em nada. Se quiser forçar uma atualização na hora, o botão “Sincronizar” faz isso manualmente. O modo ao vivo e o ensaio com YouTube precisam de rede, porque dependem de conversar com o servidor. Está tudo detalhado na seção acima.',
    ],
    [
        'q' => 'Tem aplicativo para instalar?',
        'a' => 'O Cifrô abre no navegador e pode ser adicionado à tela de início do celular. Ele passa a abrir em tela cheia, com ícone próprio, e funciona como um app — sem depender de loja de aplicativos e sem ocupar o espaço de um app comum.',
    ],
    [
        'q' => 'O que acontece com os meus dados?',
        'a' => 'Ficam guardados para operar o serviço e nada mais: não vendemos nem repassamos dados para publicidade. Cada banda só enxerga o próprio conteúdo. Você pode exportar tudo ou apagar a conta quando quiser, direto em Configurações. Os detalhes estão na <a href="' . e((string) env('PRIVACY_URL', '/privacidade.php')) . '" class="link-brand">Política de Privacidade</a>.',
    ],
    [
        'q' => 'Por que não usar o Cifra Club, que é de graça?',
        'a' => 'Use — ele é ótimo para achar e aprender uma música. O Cifrô resolve outro problema: guardar a versão que a sua banda toca, no tom de vocês, montar a ordem do domingo e abrir tudo ao mesmo tempo no celular de cada músico. E aqui o plano é por banda: menos de R$ 10 por mês para todo mundo, contra uma assinatura por pessoa em outros lugares.',
    ],
    [
        'q' => 'E se o Cifrô acabar?',
        'a' => 'Pergunta justa para um projeto pequeno em beta. Em Configurações você exporta todas as suas cifras e repertórios quando quiser, com plano ativo ou não — os arquivos são seus. Se um dia isto parar de pé, avisamos com antecedência para você exportar tudo com calma.',
    ],
    [
        'q' => 'Dá para importar minhas cifras todas de uma vez?',
        'a' => 'Hoje não — você traz uma de cada vez, colando o texto no editor (que reconhece os acordes sozinho). Se você já tem uma lista grande, escreva para <a href="mailto:' . e($supportEmail) . '" class="link-brand">' . e($supportEmail) . '</a> que ajudamos a organizar a migração.',
    ],
    [
        'q' => 'Como falo com vocês se der problema?',
        'a' => 'Por e-mail, em <a href="mailto:' . e($supportEmail) . '" class="link-brand">' . e($supportEmail) . '</a>'
            . ($whatsapp !== '' ? ', ou pelo WhatsApp <a href="https://wa.me/' . e($whatsapp) . '" class="link-brand">clicando aqui</a>' : '')
            . '. O Cifrô é um projeto pequeno e em beta: quem responde é quem desenvolve, normalmente em até um dia útil.',
    ],
];
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cifrô · Cifras e repertório para a banda inteira</title>
  <meta name="description" content="Monte o repertório uma vez e a banda inteira abre a mesma música, no mesmo tom, no próprio celular. As cifras abrem sem internet. Plano grátis, sem cartão.">
  <link rel="canonical" href="<?= e($canonical) ?>">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#0f0f0f">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Cifrô">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:url" content="<?= e($canonical) ?>">
  <meta property="og:title" content="Acabou o &quot;qual tom mesmo?&quot;">
  <meta property="og:description" content="Cifras, repertório e modo ao vivo para a banda inteira — cada um no próprio celular. Plano grátis, sem cartão.">
  <meta property="og:image" content="<?= e($ogImage) ?>">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Cifrô — acabou o &quot;qual tom mesmo?&quot;">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Acabou o &quot;qual tom mesmo?&quot;">
  <meta name="twitter:description" content="Cifras, repertório e modo ao vivo para a banda inteira — cada um no próprio celular.">
  <meta name="twitter:image" content="<?= e($ogImage) ?>">

  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="<?= e(asset_url('/src/images/cifro-mark.svg')) ?>" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/src/images/apple-icon-180x180.png">
  <link rel="manifest" href="/manifest.json">

  <?php if ($gaId !== ''): ?>
  <!-- Google Analytics 4 — gratuito; ver GA4_MEASUREMENT_ID no .env -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=<?= e($gaId) ?>"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', <?= json_encode($gaId) ?>);
  </script>
  <?php endif; ?>

  <link rel="preload" href="/src/fonts/inter/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/src/fonts/inter/Inter-SemiBold.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/src/fonts/inter/Inter-Bold.woff2" as="font" type="font/woff2" crossorigin>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :root {
      --brand: #7c3aed;
      --brand-hover: #6d28d9;
      --brand-soft: #c4b5fd;
      --bg: #0f0f0f;
      --bg-card: #1a1a1a;
      --border: #2a2a2a;
      --text: #f1f1f1;
      --text-2: #a0a0a0;
      --text-3: #8f8f8f;
      --ok: #4ade80;
      --radius: 12px;
    }
    body { margin:0;padding:0;background:var(--bg);color:var(--text);font-family:'Inter',system-ui,sans-serif;line-height:1.6; }
    a { color:inherit;text-decoration:none; }
    img { max-width:100%; }
    svg { flex:0 0 auto; }

    :where(a, button, summary, input):focus-visible {
      outline:3px solid var(--brand-soft); outline-offset:3px; border-radius:6px;
    }
    .skip-link { position:absolute;left:-9999px;top:0;background:var(--brand);color:#fff;padding:12px 20px;z-index:10;border-radius:0 0 8px 0; }
    .skip-link:focus { left:0; }
    .visually-hidden { position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0; }
    .link-brand { color:var(--brand-soft); }

    .wrap { max-width:1000px;margin:0 auto;padding-left:24px;padding-right:24px; }

    /* ── NAV ── */
    nav { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 24px;border-bottom:1px solid var(--border);max-width:1100px;margin:0 auto; }
    .nav-brand { display:flex;align-items:center;padding:9px 0;min-height:48px; }
    .nav-brand img { width:112px;height:auto;display:block; }
    .nav-links { display:flex;gap:8px;align-items:center; }
    .nav-link { padding:11px 14px;border-radius:8px;font-size:14px;color:var(--text-2);min-height:44px;display:inline-flex;align-items:center; }
    .nav-link:hover { color:#fff;background:#1e1e1e; }
    .btn-nav { padding:11px 18px;background:var(--brand);color:#fff;border-radius:8px;font-size:14px;font-weight:600;min-height:44px;display:inline-flex;align-items:center; }
    .btn-nav:hover { background:var(--brand-hover); }

    /* ── NOTICE ── */
    .notice { max-width:760px;margin:20px auto -20px;padding:14px 18px;background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.35);border-radius:10px;color:#86efac;font-size:14px;text-align:center; }

    /* ── HERO ── */
    .hero { max-width:820px;margin:0 auto;padding:72px 24px 56px;text-align:center; }
    /* Especificidade igual à de `.hero > p` de propósito: sem isso a regra do
       parágrafo do hero vence e o badge herda 19px e a cor errada. */
    .hero p.hero-badge { display:inline-block;padding:6px 15px;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.45);border-radius:999px;font-size:13px;color:var(--brand-soft);margin:0 auto 24px;max-width:none;font-weight:600; }
    .hero h1 { font-size:clamp(34px,7vw,56px);font-weight:700;line-height:1.12;margin:0 0 20px;letter-spacing:-1px; }
    .hero h1 span { color:var(--brand-soft); }
    .hero > p { font-size:19px;color:var(--text-2);margin:0 auto 34px;max-width:600px; }
    .cta-group { display:flex;gap:12px;justify-content:center;flex-wrap:wrap; }
    .btn-primary { padding:15px 30px;min-height:52px;background:var(--brand);color:#fff;border-radius:10px;font-size:16px;font-weight:700;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center; }
    .btn-primary:hover { background:var(--brand-hover); }
    .btn-secondary { padding:15px 30px;min-height:52px;background:transparent;color:var(--text-2);border-radius:10px;font-size:16px;font-weight:600;border:1px solid var(--border);cursor:pointer;display:inline-flex;align-items:center;justify-content:center; }
    .btn-secondary:hover { border-color:#555;color:#fff; }
    .hero p.hero-note { margin:18px auto 0;font-size:13px;color:var(--text-3);max-width:520px; }

    /* ── CARROSSEL DO HERO ── */
    .hero-shot { margin:44px auto 0;max-width:640px;border:1px solid var(--border);border-radius:16px;overflow:hidden;background:var(--bg-card); }
    .hero-shot-mock-tag { margin:0;padding:5px 12px;background:rgba(124,58,237,.12);border-bottom:1px solid var(--border);font-size:10.5px;color:var(--brand-soft);text-align:center; }
    .hero-carousel { position:relative; }
    .hero-carousel-track { display:flex;transition:transform .45s ease; }
    .hero-carousel-slide { flex:0 0 100%;min-width:0; }
    .hero-carousel-slide img { display:block;width:100%;height:auto; }
    .hero-carousel-dots { display:flex;gap:7px;justify-content:center;padding:12px 0;background:var(--bg-card); }
    .hero-carousel-dot { width:7px;height:7px;border-radius:999px;border:none;background:var(--border);padding:0;cursor:pointer; }
    .hero-carousel-dot[aria-current="true"] { background:var(--brand-soft);width:18px; }
    .hero-carousel-dot:focus-visible { outline:2px solid var(--brand-soft);outline-offset:2px; }

    /* ── SEÇÕES ── */
    section { padding-bottom:76px; }
    .section-title { text-align:center;font-size:29px;font-weight:700;margin:0 0 12px;letter-spacing:-.5px; }
    .section-sub { text-align:center;color:var(--text-2);font-size:16px;margin:0 auto 40px;max-width:620px; }

    /* ── PROOF ── */
    .proof-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:20px; }
    .proof-card { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:28px 24px; }
    .proof-card svg { color:var(--brand-soft);margin-bottom:14px; }
    .proof-title { font-size:17px;font-weight:700;margin:0 0 8px; }
    .proof-desc { font-size:14.5px;color:var(--text-2);line-height:1.55;margin:0; }

    /* ── COMO FUNCIONA ── */
    .steps { display:grid;grid-template-columns:repeat(3,1fr);gap:24px;counter-reset:step; }
    .step { position:relative;padding-top:8px; }
    .step-num { width:38px;height:38px;border-radius:10px;background:rgba(124,58,237,.16);border:1px solid rgba(124,58,237,.45);color:var(--brand-soft);font-weight:700;display:flex;align-items:center;justify-content:center;margin-bottom:14px; }
    .step h3 { margin:0 0 8px;font-size:17px; }
    .step p { margin:0;font-size:14.5px;color:var(--text-2);line-height:1.55; }

    /* ── OFFLINE (honesto) ── */
    .truth { background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:32px; }
    .truth-title { text-align:left;margin-bottom:6px; }
    .truth-intro { color:var(--text-2);margin:0;font-size:15px; }
    .truth-grid { display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:24px; }
    .truth-col h3 { margin:0 0 14px;font-size:15px;text-transform:uppercase;letter-spacing:.6px;color:var(--text-3); }
    .truth-col ul { list-style:none;padding:0;margin:0; }
    .truth-col li { padding:7px 0 7px 28px;position:relative;font-size:14.5px;color:var(--text-2);line-height:1.5; }
    .truth-col li::before { position:absolute;left:0;top:7px;font-weight:700; }
    .truth-yes li::before { content:'✓';color:var(--ok); }
    .truth-no  li::before { content:'✕';color:#f87171; }
    .truth-note { margin:24px 0 0;font-size:14px;color:var(--text-3);border-top:1px solid var(--border);padding-top:18px; }

    /* ── FEATURES ── */
    .features-grid { display:grid;grid-template-columns:repeat(2,1fr);gap:20px; }
    .feature-card { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:28px; }
    .feature-card svg { color:var(--brand-soft);margin-bottom:14px; }
    .feature-card h3 { margin:0 0 10px;font-size:17px; }
    .feature-card p { margin:0;font-size:14.5px;color:var(--text-2);line-height:1.55; }

    /* ── INSTALAR ── */
    .install { display:flex;gap:28px;align-items:center;background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:32px; }
    .install h2 { margin:0 0 10px;font-size:23px; }
    .install p { margin:0;color:var(--text-2);font-size:15px; }
    .install svg { color:var(--brand-soft); }

    /* ── PROVA / TRANSPARÊNCIA ── */
    .quote { max-width:720px;margin:0 auto;text-align:center; }
    .quote blockquote { margin:0 0 16px;font-size:22px;line-height:1.5;font-weight:600;letter-spacing:-.3px; }
    .quote cite { font-style:normal;color:var(--text-3);font-size:14.5px; }
    .honest { max-width:720px;margin:0 auto;border:1px dashed var(--border);border-radius:16px;padding:30px 28px; }
    .honest h2 { margin:0 0 14px;font-size:21px; }
    .honest p { margin:0 0 12px;color:var(--text-2);font-size:15px;line-height:1.65; }
    .honest p:last-child { margin-bottom:0; }

    /* ── PRICING ── */
    .pricing { text-align:center; }
    .pricing-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:40px; }
    .price-card { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:28px 20px;display:flex;flex-direction:column;position:relative;text-align:left; }
    .price-card.featured { border-color:rgba(124,58,237,.6);background:#1a1230; }
    .price-badge { position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--brand);color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;white-space:nowrap; }
    .price-name { font-size:14px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px; }
    .price-tag { font-size:34px;font-weight:700;color:#fff;line-height:1; }
    .price-tag span { font-size:15px;font-weight:400;color:var(--text-2); }
    .price-period { font-size:12.5px;color:var(--text-3);margin:6px 0 8px; }
    .price-economy { font-size:12.5px;color:var(--ok);font-weight:600;min-height:19px; }
    .price-divider { border:none;border-top:1px solid var(--border);margin:20px 0; }
    .price-features { list-style:none;padding:0;margin:0 0 24px;flex:1; }
    .price-features li { padding:5px 0;font-size:13.5px;color:var(--text-2); }
    .price-features li::before { content:'✓  ';color:var(--brand-soft);font-weight:700; }
    .price-features li.limit { color:var(--text-3); }
    .price-features li.limit::before { content:'·  ';color:var(--text-3); }
    .btn-plan { display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;padding:12px;border-radius:8px;font-size:14px;font-weight:700;text-align:center;cursor:pointer; }
    .btn-plan-outline { background:transparent;border:1px solid var(--border);color:var(--text-2); }
    .btn-plan-outline:hover { border-color:#555;color:#fff; }
    .btn-plan-primary { background:var(--brand);color:#fff;border:none; }
    .btn-plan-primary:hover { background:var(--brand-hover); }
    .pricing-note { color:var(--text-3);font-size:13.5px;margin-top:24px; }

    /* ── FAQ ── */
    .faq { max-width:760px;margin:0 auto; }
    .faq details { border-bottom:1px solid var(--border); }
    .faq summary { cursor:pointer;padding:18px 32px 18px 0;font-size:16px;font-weight:600;list-style:none;position:relative;min-height:48px;display:flex;align-items:center; }
    .faq summary::-webkit-details-marker { display:none; }
    .faq summary::after { content:'+';position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:22px;color:var(--brand-soft);font-weight:400;line-height:1; }
    .faq details[open] summary::after { content:'−'; }
    .faq details p { margin:0 0 18px;color:var(--text-2);font-size:14.5px;line-height:1.65; }

    /* ── CTA FINAL ── */
    .final-cta { text-align:center; }
    .final-cta h2 { font-size:31px;font-weight:700;margin:0 0 14px;letter-spacing:-.5px; }
    .final-cta > p { color:var(--text-2);margin:0 auto 28px;max-width:520px; }

    /* ── FOOTER ── */
    footer { border-top:1px solid var(--border);padding:32px 24px 40px;font-size:13.5px;color:var(--text-3);text-align:center; }
    footer a { color:var(--text-3);text-decoration:underline;text-underline-offset:3px; }
    .footer-nav a { display:inline-flex;align-items:center;min-height:44px;padding:0 4px; }
    footer a:hover { color:var(--text); }
    .footer-nav { display:flex;flex-wrap:wrap;gap:6px 20px;justify-content:center;margin-bottom:14px; }
    .footer-legal { max-width:640px;margin:0 auto;line-height:1.7; }

    @media (max-width:860px) {
      .truth-grid { grid-template-columns:1fr;gap:20px; }
      .install { flex-direction:column;text-align:center;gap:18px; }
    }
    @media (max-width:760px) { .pricing-grid { grid-template-columns:1fr 1fr; } }
    @media (max-width:640px) {
      .proof-grid, .features-grid, .steps { grid-template-columns:1fr; }
      .hero { padding-top:52px; }
      nav { padding:12px 16px; }
      .nav-brand { flex:0 0 auto; }
      .nav-brand img { width:88px; }
      .nav-links { gap:6px; }
      .nav-link-secondary { display:none; }
      .nav-link { padding:11px 10px; }
      .btn-nav { white-space:nowrap;padding:11px 14px; }
      .truth { padding:24px 20px; }
    }
    @media (max-width:480px) { .pricing-grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <a class="skip-link" href="#conteudo">Pular para o conteúdo</a>

  <!-- NAV -->
  <nav>
    <a href="/landing.php" class="nav-brand" aria-label="Cifrô — página inicial"><img src="/src/images/cifro-logo.svg" alt="Cifrô" width="112" height="30"></a>
    <div class="nav-links">
      <a href="#como-funciona" class="nav-link nav-link-secondary">Como funciona</a>
      <a href="#precos" class="nav-link nav-link-secondary">Preços</a>
      <a href="/login.php" class="nav-link">Entrar</a>
      <a href="/register.php" class="btn-nav" data-cifro-event="cta_nav">Criar conta grátis</a>
    </div>
  </nav>

  <?php if ($contaExcluida): ?>
    <p class="notice" role="status">Sua conta foi excluída e seus dados foram removidos. Obrigado por ter testado o Cifrô.</p>
  <?php endif; ?>

  <main id="conteudo">

  <!-- HERO -->
  <section class="hero">
    <p class="hero-badge">Plano grátis · sem cartão · em beta aberto</p>
    <h1>Acabou o <span>“qual tom mesmo?”</span></h1>
    <p>Cifras e repertório para bandas e ministérios de louvor. Você monta a lista de domingo uma vez — a banda inteira abre a mesma música, no mesmo tom, no próprio celular.</p>
    <div class="cta-group">
      <a href="/register.php" class="btn-primary" data-cifro-event="cta_hero">Criar conta grátis</a>
      <a href="#como-funciona" class="btn-secondary" data-cifro-event="cta_hero_secondary">Ver como funciona</a>
    </div>
    <p class="hero-note">Comece de graça, sem cartão. Quando quiser liberar tudo: R$ 9,90 por mês pela banda inteira — não por músico.</p>

    <?php if ($heroShot): ?>
      <div class="hero-shot">
        <?php if ($heroIsMock): ?>
          <p class="hero-shot-mock-tag">Ilustração — capturas reais em breve</p>
        <?php endif; ?>
        <div class="hero-carousel" id="hero-carousel">
          <div class="hero-carousel-track">
            <?php foreach ($heroSlides as $i => $slide): ?>
              <div class="hero-carousel-slide">
                <img src="<?= e($slide['src']) ?>" width="1200" height="720"
                     <?= $i === 0 ? 'fetchpriority="high"' : '' ?>
                     alt="<?= e($slide['alt']) ?>">
              </div>
            <?php endforeach; ?>
          </div>
          <?php if (count($heroSlides) > 1): ?>
            <div class="hero-carousel-dots" role="tablist" aria-label="Telas do Cifrô">
              <?php foreach ($heroSlides as $i => $slide): ?>
                <button type="button" class="hero-carousel-dot" role="tab" aria-current="<?= $i === 0 ? 'true' : 'false' ?>" aria-label="Ver tela <?= $i + 1 ?> de <?= count($heroSlides) ?>"></button>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>
        </div>
      </div>
    <?php endif; ?>
  </section>

  <!-- PROOF OF VALUE -->
  <section class="proof wrap">
    <h2 class="visually-hidden">O que o Cifrô resolve</h2>
    <div class="proof-grid">
      <div class="proof-card">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        <h3 class="proof-title">Cifra que dá pra ler no palco</h3>
        <p class="proof-desc">Acordes destacados acima da letra, fonte grande e fundo escuro. Muda o tom num toque e a cifra inteira transpõe junto.</p>
      </div>
      <div class="proof-card">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 15h8"/></svg>
        <h3 class="proof-title">Repertório salvo por data</h3>
        <p class="proof-desc">A ordem do domingo definida antes do ensaio, cada música já no tom certo. Ninguém mais procura PDF no grupo do WhatsApp.</p>
      </div>
      <div class="proof-card">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5a9 9 0 0 1 14 0"/><path d="M8.5 16a4.5 4.5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1.2"/><path d="M2 9a13 13 0 0 1 20 0"/></svg>
        <h3 class="proof-title">Modo ao vivo</h3>
        <p class="proof-desc">O líder passa para a próxima música e a tela de todo mundo vira junto. Ninguém pergunta "qual é a próxima?" no meio do culto.</p>
      </div>
    </div>
  </section>

  <!-- COMO FUNCIONA -->
  <section id="como-funciona" class="wrap">
    <h2 class="section-title">Como funciona</h2>
    <p class="section-sub">Do cadastro ao primeiro domingo usando, sem instalar nada no computador.</p>
    <div class="steps">
      <div class="step">
        <div class="step-num" aria-hidden="true">1</div>
        <h3>Crie a banda</h3>
        <p>Nome, e-mail e o nome da banda. Você confirma pelo e-mail, define a senha e já está dentro.</p>
      </div>
      <div class="step">
        <div class="step-num" aria-hidden="true">2</div>
        <h3>Coloque as músicas</h3>
        <p>Cole ou escreva a cifra no editor. Os acordes são reconhecidos sozinhos e a letra fica alinhada. Depois é só arrastar para o repertório da data.</p>
      </div>
      <div class="step">
        <div class="step-num" aria-hidden="true">3</div>
        <h3>Convide a banda</h3>
        <p>Cada músico entra com o próprio login e abre o repertório no celular. No plano pago, quantos músicos você quiser.</p>
      </div>
    </div>
  </section>

  <!-- FEATURES -->
  <section class="features wrap">
    <h2 class="section-title">Feito para o que acontece no ensaio</h2>
    <p class="section-sub">Não é um site de cifras. É a ferramenta que a sua banda usa junto.</p>
    <div class="features-grid">
      <div class="feature-card">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
        <h3>Modo escuro e fonte grande</h3>
        <p>Tela pensada para o palco: fundo preto para não ofuscar, tamanho de letra que você regula e enxerga de longe, sem nada piscando na frente.</p>
      </div>
      <div class="feature-card">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
        <h3>Editor de cifras</h3>
        <p>Cole a cifra de onde ela estiver e edite com o resultado aparecendo ao lado. Os acordes são reconhecidos sozinhos — você não marca nada à mão.</p>
      </div>
      <div class="feature-card">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.7 5.1a13 13 0 0 1 10.9 3.6"/><path d="M2.4 8.7a13 13 0 0 1 4.2-2.8"/><path d="M5.4 12.4a9 9 0 0 1 3-1.9"/><path d="M13.5 10.8a9 9 0 0 1 4.8 2"/><path d="M8.8 16a4.5 4.5 0 0 1 6.1-.3"/><circle cx="12" cy="19.5" r="1.2"/></svg>
        <h3>Suas cifras abrem sem internet</h3>
        <p>Abra o Cifrô em casa, no wi-fi, uma vez. As cifras ficam salvas no próprio celular e abrem no domingo mesmo sem sinal nenhum. O wi-fi da igreja deixa de ser problema seu — só o modo ao vivo precisa de rede.</p>
      </div>
      <div class="feature-card">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M10 9l5 3-5 3z"/></svg>
        <h3>Ensaio direto do YouTube</h3>
        <p>Repete só a ponte até acertar, diminui a velocidade sem desafinar e sobe o tom do vídeo para o da sua banda. Ensaie em casa antes de subir no palco.</p>
      </div>
    </div>
  </section>

  <!-- OFFLINE — o que funciona sem internet, honestamente -->
  <section class="wrap">
    <div class="truth">
      <h2 class="section-title truth-title">E quando a internet cai?</h2>
      <p class="truth-intro">Antes de sair de casa, abra o Cifrô com internet uma vez — ele guarda suas músicas e repertórios no próprio aparelho. Sendo direto sobre o que isso cobre:</p>
      <div class="truth-grid">
        <div class="truth-col truth-yes">
          <h3>Funciona sem internet</h3>
          <ul>
            <li>Abrir suas cifras e ler no palco</li>
            <li>Abrir os repertórios e roteiros salvos</li>
            <li>Transpor o tom e ajustar a fonte</li>
            <li>Navegar entre as músicas da lista</li>
          </ul>
        </div>
        <div class="truth-col truth-no">
          <h3>Precisa de internet</h3>
          <ul>
            <li>O modo ao vivo (é ele que sincroniza as telas)</li>
            <li>Ensaiar com o vídeo do YouTube</li>
            <li>Salvar e receber alterações da banda</li>
            <li>Convidar músicos e mexer no plano</li>
          </ul>
        </div>
      </div>
      <p class="truth-note">O que você editar offline sobe sozinho assim que a conexão voltar. Preferimos dizer isso agora do que você descobrir no domingo.</p>
    </div>
  </section>

  <!-- INSTALAR -->
  <section class="wrap">
    <div class="install">
      <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18.5h2"/></svg>
      <div>
        <h2>Instale no celular, sem loja de aplicativos</h2>
        <p>Abra o <?= e($siteHost) ?> no navegador do celular e escolha "adicionar à tela de início". O ícone fica junto dos outros apps, abre em tela cheia e quase não ocupa espaço. Nada de Play Store, nada de atualizar na mão.</p>
      </div>
    </div>
  </section>

  <!-- PROVA SOCIAL (só se real) / TRANSPARÊNCIA -->
  <?php if ($quote !== '' && $quoteAuthor !== ''): ?>
  <section class="wrap">
    <div class="quote">
      <blockquote>“<?= e($quote) ?>”</blockquote>
      <cite><?= e($quoteAuthor) ?></cite>
    </div>
  </section>
  <?php else: ?>
  <section class="wrap">
    <div class="honest">
      <h2>Onde o Cifrô está hoje</h2>
      <p>O Cifrô está em beta aberto. Ele nasceu dentro de um ministério de louvor que cansou de mandar PDF no grupo e descobrir no domingo que cada um tinha imprimido num tom.</p>
      <p>Ainda não temos depoimento de cliente nem número de usuários para mostrar aqui — e preferimos deixar o espaço vazio a preencher com coisa inventada. O que dá pra fazer hoje é o que está escrito nesta página, e o plano grátis existe justamente para você conferir antes de pagar qualquer coisa.</p>
      <p>Achou um problema ou faltou alguma coisa? Escreva para <a href="mailto:<?= e($supportEmail) ?>" class="link-brand"><?= e($supportEmail) ?></a>. Quem responde é quem desenvolve.</p>
    </div>
  </section>
  <?php endif; ?>

  <!-- PRICING -->
  <section id="precos" class="pricing wrap">
    <h2 class="section-title">Menos de R$ 10 por mês. Para a banda inteira.</h2>
    <p class="section-sub">Não é por músico. Um plano pago libera músicas, repertórios, modo ao vivo e membros ilimitados para todo mundo.</p>

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
          <li class="limit">Só você (sem outros membros)</li>
          <li>Cifras abrem offline</li>
          <li class="limit">Modo ao vivo (a partir do plano pago)</li>
        </ul>
        <a href="/register.php" class="btn-plan btn-plan-outline" data-cifro-event="cta_plano_gratuito">Começar grátis</a>
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
          <li>Membros ilimitados</li>
          <li>Modo ao vivo</li>
          <li>Cifras abrem offline</li>
        </ul>
        <a href="/register.php?plano=mensal" class="btn-plan btn-plan-outline" data-cifro-event="cta_plano_mensal">Assinar mensal</a>
      </div>

      <!-- SEMESTRAL -->
      <div class="price-card featured">
        <div class="price-badge">Mais popular</div>
        <div class="price-name">Semestral</div>
        <div class="price-tag">R$49<span>,90/6 meses</span></div>
        <div class="price-period">sai a R$8,32 por mês</div>
        <div class="price-economy">Economize R$9,50 vs mensal</div>
        <hr class="price-divider">
        <ul class="price-features">
          <li>Músicas ilimitadas</li>
          <li>Repertórios e roteiros</li>
          <li>Membros ilimitados</li>
          <li>Modo ao vivo</li>
          <li>Cifras abrem offline</li>
        </ul>
        <a href="/register.php?plano=semestral" class="btn-plan btn-plan-primary" data-cifro-event="cta_plano_semestral">Assinar semestral</a>
      </div>

      <!-- ANUAL -->
      <div class="price-card">
        <div class="price-name">Anual</div>
        <div class="price-tag">R$89<span>,90/ano</span></div>
        <div class="price-period">sai a R$7,49 por mês</div>
        <div class="price-economy">Economize R$28,90 vs mensal</div>
        <hr class="price-divider">
        <ul class="price-features">
          <li>Músicas ilimitadas</li>
          <li>Repertórios e roteiros</li>
          <li>Membros ilimitados</li>
          <li>Modo ao vivo</li>
          <li>Cifras abrem offline</li>
        </ul>
        <a href="/register.php?plano=anual" class="btn-plan btn-plan-outline" data-cifro-event="cta_plano_anual">Assinar anual</a>
      </div>

    </div>
    <p class="pricing-note">Você cria a conta no plano gratuito e só paga se quiser passar dos limites. Cartão pelo Stripe ou Pix. Assinou no cartão, cancela sozinho pela sua conta — sem multa e sem fidelidade.</p>
  </section>

  <!-- FAQ -->
  <section class="wrap">
    <h2 class="section-title">Perguntas que todo mundo faz</h2>
    <div class="faq">
      <?php foreach ($faqItems as $item): ?>
      <details>
        <summary><?= e($item['q']) ?></summary>
        <p><?= $item['a'] ?></p>
      </details>
      <?php endforeach; ?>
    </div>
  </section>

  <!-- FINAL CTA -->
  <section class="final-cta wrap">
    <h2>Coloque o repertório de domingo no Cifrô hoje</h2>
    <p>Leva alguns minutos para cadastrar as primeiras músicas. Plano grátis, sem cartão de crédito, e você decide depois se vale pagar.</p>
    <a href="/register.php" class="btn-primary" data-cifro-event="cta_final">Criar conta grátis</a>
  </section>

  </main>

  <footer>
    <div class="footer-nav">
      <a href="#como-funciona">Como funciona</a>
      <a href="#precos">Preços</a>
      <a href="/login.php">Entrar</a>
      <a href="mailto:<?= e($supportEmail) ?>"><?= e($supportEmail) ?></a>
      <?php if ($whatsapp !== ''): ?><a href="https://wa.me/<?= e($whatsapp) ?>">WhatsApp</a><?php endif; ?>
      <a href="<?= e((string) env('TERMS_URL', '/termos.php')) ?>">Termos de Uso</a>
      <a href="<?= e((string) env('PRIVACY_URL', '/privacidade.php')) ?>">Política de Privacidade</a>
    </div>
    <p class="footer-legal">
      <strong>Cifrô</strong> — cifro.online.
      Projeto independente em beta, mantido por <?= $ownerName !== '' ? e($ownerName) : 'pessoa física' ?><?= $ownerCity !== '' ? ', ' . e($ownerCity) : '' ?>.
      Ainda sem CNPJ: o responsável atende diretamente por <a href="mailto:<?= e($supportEmail) ?>"><?= e($supportEmail) ?></a>.
    </p>
  </footer>

  <script type="application/ld+json">
  <?= json_encode([
      '@context'    => 'https://schema.org',
      '@type'       => 'SoftwareApplication',
      'name'        => 'Cifrô',
      'url'         => $siteUrl,
      'applicationCategory' => 'MusicApplication',
      'operatingSystem'     => 'Web, Android, iOS',
      'inLanguage'  => 'pt-BR',
      'description' => 'Cifras, repertórios e modo ao vivo para bandas e ministérios de louvor. As cifras abrem sem internet.',
      'offers'      => [
          ['@type' => 'Offer', 'name' => 'Gratuito',  'price' => '0',     'priceCurrency' => 'BRL'],
          ['@type' => 'Offer', 'name' => 'Mensal',    'price' => '9.90',  'priceCurrency' => 'BRL'],
          ['@type' => 'Offer', 'name' => 'Semestral', 'price' => '49.90', 'priceCurrency' => 'BRL'],
          ['@type' => 'Offer', 'name' => 'Anual',     'price' => '89.90', 'priceCurrency' => 'BRL'],
      ],
  ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>
  </script>

  <script type="application/ld+json">
  <?= json_encode([
      '@context'   => 'https://schema.org',
      '@type'      => 'FAQPage',
      'mainEntity' => array_map(static function (array $item): array {
          return [
              '@type'          => 'Question',
              'name'           => $item['q'],
              'acceptedAnswer' => [
                  '@type' => 'Answer',
                  'text'  => trim(preg_replace('/\s+/', ' ', strip_tags($item['a']))),
              ],
          ];
      }, $faqItems),
  ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>
  </script>

  <?php if (count($heroSlides) > 1): ?>
  <script>
    (function () {
      var root = document.getElementById('hero-carousel');
      if (!root) return;
      var track = root.querySelector('.hero-carousel-track');
      var slides = root.querySelectorAll('.hero-carousel-slide');
      var dots = root.querySelectorAll('.hero-carousel-dot');
      var i = 0, timer = null;

      function go(n) {
        i = (n + slides.length) % slides.length;
        track.style.transform = 'translateX(-' + (i * 100) + '%)';
        dots.forEach(function (d, idx) { d.setAttribute('aria-current', idx === i ? 'true' : 'false'); });
      }
      function next() { go(i + 1); }
      function start() { stop(); timer = setInterval(next, 4000); }
      function stop() { if (timer) clearInterval(timer); }

      dots.forEach(function (d, idx) {
        d.addEventListener('click', function () { go(idx); stop(); start(); });
      });
      root.addEventListener('mouseenter', stop);
      root.addEventListener('mouseleave', start);
      start();
    })();
  </script>
  <?php endif; ?>

  <script src="/src/js/cifro-analytics.js" defer></script>
</body>
</html>
