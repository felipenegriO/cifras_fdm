<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Plano — Cifrô</title>
  <?php csrf_meta(); ?>
  <script src="<?= asset_url('/src/js/cifro-theme.js') ?>"></script>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <link href="/src/css/theme.css" rel="stylesheet">
  <script src="<?= asset_url('/src/js/cifro-toast.js') ?>"></script>
  <style>
    body { margin: 0; padding: 0; }
    .plan-wrap { max-width: 760px; margin: 0 auto; padding: var(--space-4); }
    .plan-wrap h1 { font-size: var(--text-xl); font-weight: var(--fw-bold); margin: 0 0 var(--space-4); }

    /* ── Status card ── */
    .plan-status {
      background: var(--bg-1);
      border: 1px solid var(--border-1);
      border-radius: var(--radius-md);
      padding: var(--space-5);
      margin-bottom: var(--space-4);
      display: flex;
      align-items: center;
      gap: var(--space-4);
      flex-wrap: wrap;
    }
    .plan-status__icon {
      width: 52px; height: 52px; border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center;
      font-size: 26px; flex-shrink: 0;
    }
    .plan-status__icon--gratuito { background: rgba(99,102,241,.12); }
    .plan-status__icon--pago     { background: rgba(52,211,153,.12); }
    .plan-status__icon--bloqueado{ background: rgba(239,68,68,.12); }
    .plan-status__info { flex: 1; min-width: 0; }
    .plan-status__name { font-size: var(--text-lg); font-weight: var(--fw-bold); margin: 0 0 4px; }
    .plan-status__desc { font-size: var(--text-sm); color: var(--text-2); margin: 0; }
    .plan-badge {
      display: inline-block; padding: 3px 10px;
      border-radius: var(--radius-pill); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .04em;
    }
    .plan-badge--gratuito { background: rgba(99,102,241,.12); color: #818cf8; border: 1px solid rgba(99,102,241,.25); }
    .plan-badge--pago     { background: rgba(52,211,153,.12); color: #34d399; border: 1px solid rgba(52,211,153,.25); }
    .plan-badge--bloqueado{ background: rgba(239,68,68,.1);   color: #f87171; border: 1px solid rgba(239,68,68,.2); }

    /* ── Usage bar ── */
    .plan-usage {
      background: var(--bg-1); border: 1px solid var(--border-1);
      border-radius: var(--radius-md); padding: var(--space-4);
      margin-bottom: var(--space-4);
    }
    .plan-usage h2 { font-size: var(--text-sm); font-weight: var(--fw-semibold);
      text-transform: uppercase; letter-spacing: .06em; color: var(--text-2);
      margin: 0 0 var(--space-3); }
    .usage-row { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
    .usage-row:last-child { margin-bottom: 0; }
    .usage-label { font-size: var(--text-sm); color: var(--text-1); width: 80px; flex-shrink: 0; }
    .usage-bar-wrap { flex: 1; background: var(--bg-3); border-radius: var(--radius-pill); height: 6px; overflow: hidden; }
    .usage-bar { height: 100%; border-radius: var(--radius-pill); transition: width .4s; }
    .usage-bar--ok      { background: var(--brand); }
    .usage-bar--warn    { background: #f59e0b; }
    .usage-bar--full    { background: #ef4444; }
    .usage-bar--unlimited { background: var(--brand); width: 30%; opacity: .4; }
    .usage-count { font-size: var(--text-xs); color: var(--text-3); width: 90px; text-align: right; flex-shrink: 0; }

    /* ── Pricing cards ── */
    .plan-section-title {
      font-size: var(--text-base); font-weight: var(--fw-semibold);
      color: var(--text-2); text-transform: uppercase; letter-spacing: .06em;
      margin: 0 0 var(--space-3);
    }
    .pricing-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3);
      margin-bottom: var(--space-4);
    }
    .price-card {
      background: var(--bg-1); border: 1px solid var(--border-1);
      border-radius: var(--radius-md); padding: var(--space-4);
      display: flex; flex-direction: column; position: relative;
      transition: border-color .2s;
    }
    .price-card:hover { border-color: var(--brand); }
    .price-card--current { border-color: var(--brand); background: var(--bg-2); }
    .price-card--popular { border-color: rgba(124,58,237,.5); }
    .price-card__badge {
      position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
      background: var(--brand); color: #fff; font-size: 10px; font-weight: 700;
      padding: 2px 10px; border-radius: var(--radius-pill); white-space: nowrap;
    }
    .price-card__current-badge {
      position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
      background: #34d399; color: #000; font-size: 10px; font-weight: 700;
      padding: 2px 10px; border-radius: var(--radius-pill); white-space: nowrap;
    }
    .price-card__name { font-size: var(--text-xs); font-weight: 700; text-transform: uppercase;
      letter-spacing: .05em; color: var(--text-2); margin-bottom: var(--space-2); }
    .price-card__value { font-size: 28px; font-weight: 800; color: var(--text-1); line-height: 1; }
    .price-card__value span { font-size: 13px; font-weight: 400; color: var(--text-2); }
    .price-card__period { font-size: var(--text-xs); color: var(--text-3); margin: 4px 0; }
    .price-card__economy { font-size: var(--text-xs); color: #34d399; font-weight: 600; min-height: 16px; }
    .price-card__features { list-style: none; padding: 0; margin: var(--space-3) 0; flex: 1;
      border-top: 1px solid var(--border-1); padding-top: var(--space-3); }
    .price-card__features li { font-size: var(--text-xs); color: var(--text-2); padding: 3px 0; }
    .price-card__features li::before { content: '✓  '; color: var(--brand); font-weight: 700; }
    .price-card__features li.limit::before { content: '·  '; color: var(--text-3); }
    .price-card__features li.limit { color: var(--text-3); }
    .btn-upgrade {
      display: block; width: 100%; padding: 9px; border-radius: var(--radius-sm);
      font-size: var(--text-sm); font-weight: 700; text-align: center;
      cursor: pointer; border: none; text-decoration: none; margin-top: auto;
    }
    .btn-upgrade--primary { background: var(--brand); color: #fff; }
    .btn-upgrade--primary:hover { opacity: .9; }
    .btn-upgrade--outline { background: transparent; border: 1px solid var(--border-2);
      color: var(--text-2); }
    .btn-upgrade--outline:hover { border-color: var(--brand); color: var(--text-1); }
    .btn-upgrade--current { background: var(--bg-3); color: var(--text-3); cursor: default; }
    .btn-upgrade--disabled { background: var(--bg-3); color: var(--text-3); cursor: not-allowed; }

    .payment-note {
      display: flex; align-items: center; gap: var(--space-3);
      background: rgba(52,211,153,.08); border: 1px solid rgba(52,211,153,.2);
      border-radius: var(--radius-md); padding: var(--space-4); margin-bottom: var(--space-4);
    }
    .payment-note__icon {
      width: 42px; height: 42px; flex-shrink: 0; border-radius: var(--radius-md);
      display: grid; place-items: center; background: rgba(52,211,153,.12); font-size: 22px;
    }
    .payment-note strong { display: block; color: var(--text-1); margin-bottom: 2px; }
    .payment-note p { margin: 0; color: var(--text-2); font-size: var(--text-sm); }

    .pix-modal[hidden] { display: none; }
    .pix-modal {
      position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center;
      padding: var(--space-4); background: rgba(0,0,0,.72); backdrop-filter: blur(4px);
    }
    .pix-modal__dialog {
      width: min(100%, 480px); max-height: calc(100vh - 32px); overflow-y: auto;
      background: var(--bg-1); border: 1px solid var(--border-2); border-radius: var(--radius-lg);
      box-shadow: 0 24px 80px rgba(0,0,0,.45);
    }
    .pix-modal__header {
      display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3);
      padding: var(--space-5); border-bottom: 1px solid var(--border-1);
    }
    .pix-modal__eyebrow {
      margin: 0 0 4px; color: #34d399; font-size: var(--text-xs); font-weight: 700;
      letter-spacing: .06em; text-transform: uppercase;
    }
    .pix-modal__header h2 { margin: 0; font-size: var(--text-lg); }
    .pix-modal__close {
      width: 34px; height: 34px; flex-shrink: 0; border: 0; border-radius: var(--radius-sm);
      background: var(--bg-3); color: var(--text-2); cursor: pointer; font-size: 22px;
    }
    .pix-modal__body { padding: var(--space-5); }
    .pix-step { display: grid; grid-template-columns: 30px 1fr; gap: var(--space-3); margin-bottom: var(--space-5); }
    .pix-step:last-child { margin-bottom: 0; }
    .pix-step__number {
      width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%;
      background: rgba(124,58,237,.16); color: var(--brand); font-size: var(--text-sm); font-weight: 800;
    }
    .pix-step h3 { margin: 3px 0 var(--space-2); font-size: var(--text-sm); }
    .pix-step p { margin: 0; color: var(--text-2); font-size: var(--text-sm); }
    .pix-key {
      display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-3);
      padding: var(--space-3); background: var(--bg-2); border: 1px solid var(--border-1);
      border-radius: var(--radius-sm);
    }
    .pix-key code { flex: 1; min-width: 0; overflow-wrap: anywhere; color: var(--text-1); font-size: var(--text-sm); }
    .pix-copy {
      border: 0; border-radius: var(--radius-sm); background: var(--brand); color: #fff;
      padding: 8px 12px; cursor: pointer; font-weight: 700;
    }
    .pix-recipient { display: block; margin-top: 6px; color: var(--text-3); font-size: var(--text-xs); }
    .pix-whatsapp {
      display: block; margin-top: var(--space-3); padding: 11px; border-radius: var(--radius-sm);
      background: #25d366; color: #071d0e; font-size: var(--text-sm); font-weight: 800;
      text-align: center; text-decoration: none;
    }
    .pix-whatsapp:hover { background: #4ade80; }
    .pix-modal__footnote {
      margin: var(--space-4) 0 0; padding-top: var(--space-4); border-top: 1px solid var(--border-1);
      color: var(--text-3); font-size: var(--text-xs); text-align: center;
    }

    /* ── Free plan row ── */
    .plan-free-row {
      background: var(--bg-1); border: 1px solid var(--border-1);
      border-radius: var(--radius-md); padding: var(--space-4);
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-4);
    }
    .plan-free-row p { margin: 0; font-size: var(--text-sm); color: var(--text-2); }
    .plan-free-row strong { color: var(--text-1); }
    .plan-management {
      background: var(--bg-1); border: 1px solid var(--border-1);
      border-radius: var(--radius-md); padding: var(--space-4);
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-4);
    }
    .plan-management strong { display: block; margin-bottom: 3px; color: var(--text-1); }
    .plan-management p { margin: 0; color: var(--text-2); font-size: var(--text-sm); }
    .plan-management__action {
      display: inline-flex; align-items: center; justify-content: center;
      min-height: 38px; padding: 0 14px; border: 1px solid var(--border-2);
      border-radius: var(--radius-sm); color: var(--text-2); text-decoration: none;
      font-size: var(--text-sm); font-weight: 700;
    }
    .plan-management__action:hover { border-color: #ef4444; color: #f87171; }

    /* ── Blocked banner ── */
    .plan-blocked {
      background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.25);
      border-radius: var(--radius-md); padding: var(--space-4);
      margin-bottom: var(--space-4); text-align: center;
    }
    .plan-blocked p { margin: 0 0 var(--space-3); color: var(--text-2); font-size: var(--text-sm); }
    .plan-blocked h3 { margin: 0 0 var(--space-2); color: #f87171; }

    @media (max-width: 600px) {
      .pricing-grid { grid-template-columns: 1fr; }
      .plan-status { flex-direction: column; text-align: center; }
      .plan-wrap { padding: 12px; }
      .price-card, .plan-usage, .plan-status { min-width: 0; }
      .btn-upgrade, .plan-management__action, .pix-copy, .pix-whatsapp, .pix-modal__close { min-height: 44px; }
      .payment-note { align-items: flex-start; }
    }
    @media (max-width: 430px) {
      .usage-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; }
      .usage-label, .usage-count { width: auto; }
      .usage-bar-wrap { grid-column: 1 / -1; grid-row: 2; }
      .pix-modal { padding: 8px; }
      .pix-modal__header, .pix-modal__body { padding: 16px; }
      .pix-key { align-items: stretch; flex-direction: column; }
      .pix-key code { word-break: normal; overflow-wrap: break-word; }
    }
  </style>
</head>
<body>
<?php render_partial('topnav'); ?>

<?php
$banda      = $_SESSION['banda_atual'] ?? [];
$bandaId    = $banda['id'] ?? '';
$plano      = ($banda['plano'] ?? 'gratuito') === 'trial' ? 'gratuito' : ($banda['plano'] ?? 'gratuito');

// Contar músicas e bandas do usuário
$totalMusicas = 0;
$totalBandas  = 0;
$totalUsuarios = 0;
$totalPlaylists = 0;
$userId = $_SESSION['usuario']['id'] ?? null;
if ($bandaId) {
    try {
        $repoMusica = new MusicaRepository();
        $totalMusicas = $repoMusica->countByBanda($bandaId);
    } catch (Throwable $e) { $totalMusicas = 0; }
    try {
        $totalUsuarios = (new UserRepository())->countByBanda($bandaId);
    } catch (Throwable $e) { $totalUsuarios = 0; }
    try {
        $totalPlaylists = (new PlaylistRepository())->countByBanda($bandaId);
    } catch (Throwable $e) { $totalPlaylists = 0; }
}
if ($userId) {
    try {
        $repoBanda = new BandaRepository();
        $totalBandas = $repoBanda->countByUsuario($userId);
    } catch (Throwable $e) { $totalBandas = 0; }
}

$limites    = cifro_plan_limits($plano);
$limMusicas = $limites['musicas']; // -1 = ilimitado
$limBandas  = $limites['bandas'];  // -1 = ilimitado
$limUsuarios = $limites['users'];
$limPlaylists = $limites['playlists'];

$isPago = in_array($plano, ['mensal', 'semestral', 'anual', 'ativo']);
$isGratuito = $plano === 'gratuito';
$isBloqueado = $plano === 'bloqueado';

$stripeSecret = (string)env('STRIPE_SECRET_KEY', '');
$stripeLinks = [
    'mensal'    => trim((string)env('STRIPE_LINK_MENSAL', '')),
    'semestral' => trim((string)env('STRIPE_LINK_SEMESTRAL', '')),
    'anual'     => trim((string)env('STRIPE_LINK_ANUAL', '')),
];
foreach ($stripeLinks as $tipo => $link) {
    if (!PlanoViewModel::isStripeLinkValid($stripeSecret, $link)) {
        $stripeLinks[$tipo] = '';
    }
}

$pixPhoneRaw = trim((string)env('PAYMENT_PIX_PHONE', ''));
$pixRecipient = trim((string)env('PAYMENT_PIX_RECIPIENT', ''));
$whatsappSource = trim((string)env('PAYMENT_WHATSAPP_PHONE', ''));
$pixPhoneDigits = PlanoViewModel::normalizePhone($pixPhoneRaw);
$whatsappPhone = PlanoViewModel::normalizePhone($whatsappSource !== '' ? $whatsappSource : $pixPhoneRaw);
$pixPhone = '+' . $pixPhoneDigits;
$pixEnabled = PlanoViewModel::isPixEnabled($pixPhoneDigits, $whatsappPhone);
$paymentPlans = [
    'mensal'    => ['label' => 'Mensal', 'value' => 'R$ 9,90'],
    'semestral' => ['label' => 'Semestral', 'value' => 'R$ 49,90'],
    'anual'     => ['label' => 'Anual', 'value' => 'R$ 89,90'],
];
$bandaNome = (string)($_SESSION['banda_atual']['nome'] ?? 'Minha Banda');
$paymentReference = PlanoViewModel::paymentReference($bandaId);
foreach ($paymentPlans as $tipo => &$paymentPlan) {
    $paymentAction = PlanoViewModel::paymentAction($isPago, $tipo, $plano);
    $message = "Olá! Fiz o PIX de {$paymentPlan['value']} para {$paymentAction} o plano {$paymentPlan['label']} do Cifrô. Banda: {$bandaNome}. Referência: {$paymentReference}. Vou enviar o comprovante nesta conversa.";
    $paymentPlan['whatsapp'] = PlanoViewModel::buildWhatsappUrl($whatsappPhone, $message);
}
unset($paymentPlan);
$cancelMessage = "Olá! Quero solicitar o cancelamento do plano " . cifro_plan_label($plano) . " do Cifrô. Banda: {$bandaNome}. Referência: {$paymentReference}.";
$cancelUrl = PlanoViewModel::cancelUrl($pixEnabled, $whatsappPhone, $cancelMessage);
?>

<div class="plan-wrap">
  <h1><?= $isPago ? 'Plano e pagamento' : 'Meu Plano' ?></h1>

  <?php /* ── STATUS ATUAL ── */ ?>
  <div class="plan-status">
    <?php if ($isGratuito): ?>
      <div class="plan-status__icon plan-status__icon--gratuito">🎵</div>
    <?php elseif ($isPago): ?>
      <div class="plan-status__icon plan-status__icon--pago">⭐</div>
    <?php else: ?>
      <div class="plan-status__icon plan-status__icon--bloqueado">🔒</div>
    <?php endif; ?>

    <div class="plan-status__info">
      <p class="plan-status__name">
        <?= e($_SESSION['banda_atual']['nome'] ?? 'Minha Banda') ?>
        &nbsp;
        <?php $badgeClass = PlanoViewModel::badgeClass($isPago, $isBloqueado); ?>
        <span class="plan-badge plan-badge--<?= $badgeClass ?>">
          <?= e(cifro_plan_label($plano)) ?>
        </span>
      </p>
      <p class="plan-status__desc">
        <?php if ($isGratuito): ?>
          Plano gratuito permanente · 1 banda · até <?= $limMusicas ?> músicas
        <?php elseif ($isPago): ?>
          Plano <?= e(cifro_plan_label($plano)) ?> ativo · músicas e membros ilimitados
        <?php elseif ($isBloqueado): ?>
          Acesso bloqueado · assine um plano para continuar
        <?php endif; ?>
      </p>
    </div>
  </div>

  <?php /* ── BANNER BLOQUEADO ── */ ?>
  <?php if ($isBloqueado): ?>
  <div class="plan-blocked">
    <h3>🔒 Conta bloqueada</h3>
    <p>Sua conta foi bloqueada por falta de assinatura. Assine um plano abaixo para reativar o acesso imediatamente.</p>
  </div>
  <?php endif; ?>

  <?php /* ── USO DE RECURSOS ── */ ?>
  <?php if (!$isBloqueado): ?>
  <div class="plan-usage">
    <h2>Uso atual</h2>

    <?php $barMusicas = PlanoViewModel::usageBar($totalMusicas, $limMusicas); ?>
    <div class="usage-row">
      <span class="usage-label">Músicas</span>
      <div class="usage-bar-wrap">
        <?php if ($limMusicas === -1): ?>
          <div class="usage-bar usage-bar--unlimited"></div>
        <?php else: ?>
          <div class="usage-bar usage-bar--<?= $barMusicas['class'] ?>"
               style="width:<?= $barMusicas['pct'] ?>%"></div>
        <?php endif; ?>
      </div>
      <span class="usage-count">
        <?= $totalMusicas ?>
        <?= $limMusicas === -1 ? '/ ∞' : '/ ' . $limMusicas ?>
      </span>
    </div>

    <?php $barBandas = PlanoViewModel::usageBar($totalBandas, $limBandas); ?>
    <div class="usage-row">
      <span class="usage-label">Bandas</span>
      <div class="usage-bar-wrap">
        <?php if ($limBandas === -1): ?>
          <div class="usage-bar usage-bar--unlimited"></div>
        <?php else: ?>
          <div class="usage-bar usage-bar--<?= $barBandas['class'] ?>"
               style="width:<?= $barBandas['pct'] ?>%"></div>
        <?php endif; ?>
      </div>
      <span class="usage-count">
        <?= $totalBandas ?>
        <?= $limBandas === -1 ? '/ ∞' : '/ ' . $limBandas ?>
      </span>
    </div>

    <?php $barUsuarios = PlanoViewModel::simpleUsageBar($totalUsuarios, $limUsuarios); ?>
    <div class="usage-row">
      <span class="usage-label">Membros</span>
      <div class="usage-bar-wrap">
        <?php if ($limUsuarios === -1): ?>
          <div class="usage-bar usage-bar--unlimited"></div>
        <?php else: ?>
          <div class="usage-bar usage-bar--<?= $barUsuarios['class'] ?>"
               style="width:<?= $barUsuarios['pct'] ?>%"></div>
        <?php endif; ?>
      </div>
      <span class="usage-count"><?= $limUsuarios === -1 ? 'ilimitado' : $totalUsuarios . ' / ' . $limUsuarios ?></span>
    </div>

    <?php $barPlaylists = PlanoViewModel::simpleUsageBar($totalPlaylists, $limPlaylists); ?>
    <div class="usage-row">
      <span class="usage-label">Repertórios</span>
      <div class="usage-bar-wrap">
        <?php if ($limPlaylists === -1): ?>
          <div class="usage-bar usage-bar--unlimited"></div>
        <?php else: ?>
          <div class="usage-bar usage-bar--<?= $barPlaylists['class'] ?>"
               style="width:<?= $barPlaylists['pct'] ?>%"></div>
        <?php endif; ?>
      </div>
      <span class="usage-count"><?= $limPlaylists === -1 ? 'ilimitado' : $totalPlaylists . ' / ' . $limPlaylists ?></span>
    </div>
  </div>
  <?php endif; ?>

  <?php /* ── PLANOS PAGOS ── */ ?>
  <?php if (!$isPago): ?>
  <p class="plan-section-title">Fazer upgrade</p>
  <?php else: ?>
  <p class="plan-section-title">Renovar ou trocar de plano</p>
  <?php endif; ?>

  <?php if ($pixEnabled && !array_filter($stripeLinks)): ?>
  <div class="payment-note">
    <div class="payment-note__icon" aria-hidden="true">🟢</div>
    <div>
      <strong>Pagamento via PIX</strong>
      <p>Copie a chave, faça o pagamento e envie o comprovante pelo WhatsApp para liberarmos o plano.</p>
    </div>
  </div>
  <?php endif; ?>

  <div class="pricing-grid" id="planos">

    <!-- MENSAL -->
    <div class="price-card <?= $plano === 'mensal' ? 'price-card--current' : '' ?>">
      <?php if ($plano === 'mensal'): ?><div class="price-card__current-badge">✓ Plano atual</div><?php endif; ?>
      <div class="price-card__name">Mensal</div>
      <div class="price-card__value">R$9<span>,90/mês</span></div>
      <div class="price-card__period">cobrado mensalmente</div>
      <div class="price-card__economy"></div>
      <ul class="price-card__features">
        <li>Músicas ilimitadas</li>
        <li>Repertórios e roteiros</li>
        <li>Modo ao vivo</li>
        <li>Membros ilimitados</li>
        <li>Funciona offline</li>
      </ul>
      <?php if ($plano === 'mensal'): ?>
        <?php if ($stripeLinks['mensal'] !== ''): ?>
          <a href="<?= e($stripeLinks['mensal']) ?>" class="btn-upgrade btn-upgrade--outline"
             target="_blank" rel="noopener">Renovar mensal</a>
        <?php elseif ($pixEnabled): ?>
          <button type="button" class="btn-upgrade btn-upgrade--outline js-pix-payment"
                  data-plan="mensal">Renovar via PIX</button>
        <?php else: ?>
          <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
        <?php endif; ?>
      <?php elseif ($stripeLinks['mensal'] !== ''): ?>
        <a href="<?= e($stripeLinks['mensal']) ?>" class="btn-upgrade btn-upgrade--outline"
           target="_blank" rel="noopener"><?= $isPago ? 'Trocar para mensal' : 'Assinar mensal' ?></a>
      <?php elseif ($pixEnabled): ?>
        <button type="button" class="btn-upgrade btn-upgrade--outline js-pix-payment"
                data-plan="mensal"><?= $isPago ? 'Trocar para mensal' : 'Pagar mensal via PIX' ?></button>
      <?php else: ?>
        <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
      <?php endif; ?>
    </div>

    <!-- SEMESTRAL -->
    <div class="price-card <?= $plano === 'semestral' ? 'price-card--current' : 'price-card--popular' ?>">
      <?php if ($plano === 'semestral'): ?>
        <div class="price-card__current-badge">✓ Plano atual</div>
      <?php else: ?>
        <div class="price-card__badge">✦ Mais popular</div>
      <?php endif; ?>
      <div class="price-card__name">Semestral</div>
      <div class="price-card__value">R$49<span>,90/6 meses</span></div>
      <div class="price-card__period">≈ R$8,32/mês</div>
      <div class="price-card__economy">Economize R$9,50</div>
      <ul class="price-card__features">
        <li>Músicas ilimitadas</li>
        <li>Repertórios e roteiros</li>
        <li>Modo ao vivo</li>
        <li>Membros ilimitados</li>
        <li>Funciona offline</li>
      </ul>
      <?php if ($plano === 'semestral'): ?>
        <?php if ($stripeLinks['semestral'] !== ''): ?>
          <a href="<?= e($stripeLinks['semestral']) ?>" class="btn-upgrade btn-upgrade--primary"
             target="_blank" rel="noopener">Renovar semestral</a>
        <?php elseif ($pixEnabled): ?>
          <button type="button" class="btn-upgrade btn-upgrade--primary js-pix-payment"
                  data-plan="semestral">Renovar via PIX</button>
        <?php else: ?>
          <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
        <?php endif; ?>
      <?php elseif ($stripeLinks['semestral'] !== ''): ?>
        <a href="<?= e($stripeLinks['semestral']) ?>" class="btn-upgrade btn-upgrade--primary"
           target="_blank" rel="noopener"><?= $isPago ? 'Trocar para semestral' : 'Assinar semestral' ?></a>
      <?php elseif ($pixEnabled): ?>
        <button type="button" class="btn-upgrade btn-upgrade--primary js-pix-payment"
                data-plan="semestral"><?= $isPago ? 'Trocar para semestral' : 'Pagar semestral via PIX' ?></button>
      <?php else: ?>
        <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
      <?php endif; ?>
    </div>

    <!-- ANUAL -->
    <div class="price-card <?= $plano === 'anual' ? 'price-card--current' : '' ?>">
      <?php if ($plano === 'anual'): ?><div class="price-card__current-badge">✓ Plano atual</div><?php endif; ?>
      <div class="price-card__name">Anual</div>
      <div class="price-card__value">R$89<span>,90/ano</span></div>
      <div class="price-card__period">≈ R$7,49/mês</div>
      <div class="price-card__economy">Economize R$28,90</div>
      <ul class="price-card__features">
        <li>Músicas ilimitadas</li>
        <li>Repertórios e roteiros</li>
        <li>Modo ao vivo</li>
        <li>Membros ilimitados</li>
        <li>Funciona offline</li>
      </ul>
      <?php if ($plano === 'anual'): ?>
        <?php if ($stripeLinks['anual'] !== ''): ?>
          <a href="<?= e($stripeLinks['anual']) ?>" class="btn-upgrade btn-upgrade--outline"
             target="_blank" rel="noopener">Renovar anual</a>
        <?php elseif ($pixEnabled): ?>
          <button type="button" class="btn-upgrade btn-upgrade--outline js-pix-payment"
                  data-plan="anual">Renovar via PIX</button>
        <?php else: ?>
          <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
        <?php endif; ?>
      <?php elseif ($stripeLinks['anual'] !== ''): ?>
        <a href="<?= e($stripeLinks['anual']) ?>" class="btn-upgrade btn-upgrade--outline"
           target="_blank" rel="noopener"><?= $isPago ? 'Trocar para anual' : 'Assinar anual' ?></a>
      <?php elseif ($pixEnabled): ?>
        <button type="button" class="btn-upgrade btn-upgrade--outline js-pix-payment"
                data-plan="anual"><?= $isPago ? 'Trocar para anual' : 'Pagar anual via PIX' ?></button>
      <?php else: ?>
        <span class="btn-upgrade btn-upgrade--disabled">Pagamento indisponível</span>
      <?php endif; ?>
    </div>

  </div>

  <?php if ($isPago): ?>
  <div class="plan-management">
    <div>
      <strong>Cancelamento</strong>
      <p>Solicite o cancelamento pelo atendimento. Seu acesso permanece ativo até a confirmação.</p>
    </div>
    <a href="<?= e($cancelUrl) ?>" class="plan-management__action" target="_blank" rel="noopener">Solicitar cancelamento</a>
  </div>
  <?php endif; ?>

  <!-- GRATUITO (sem upgrade, só informativo) -->
  <div class="plan-free-row">
    <div>
      <strong>Plano Gratuito</strong>
      <p>Acesso permanente com <strong>1 banda</strong>, <strong>10 músicas</strong>, <strong>1 repertório</strong> e sem membros adicionais.</p>
    </div>
    <?php if ($isGratuito): ?>
      <span class="plan-badge plan-badge--gratuito">Plano atual</span>
    <?php else: ?>
      <span style="font-size:var(--text-xs);color:var(--text-3)">Disponível se cancelar</span>
    <?php endif; ?>
  </div>

  <p style="font-size:var(--text-xs);color:var(--text-3);text-align:center;margin-top:var(--space-2)">
    Dúvidas? Fale com a gente:
    <a href="mailto:contato@cifro.online" style="color:var(--text-2)">contato@cifro.online</a>
  </p>

</div>

<?php if ($pixEnabled): ?>
<div class="pix-modal" id="pix-payment-modal" hidden>
  <div class="pix-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="pix-modal-title">
    <div class="pix-modal__header">
      <div>
        <p class="pix-modal__eyebrow">Pagamento seguro via PIX</p>
        <h2 id="pix-modal-title">Plano <span id="pix-plan-label"></span> · <span id="pix-plan-value"></span></h2>
      </div>
      <button type="button" class="pix-modal__close" aria-label="Fechar">&times;</button>
    </div>
    <div class="pix-modal__body">
      <div class="pix-step">
        <span class="pix-step__number">1</span>
        <div>
          <h3>Copie a chave PIX</h3>
          <p>Abra o app do seu banco e faça o PIX no valor exato do plano.</p>
          <div class="pix-key">
            <code id="pix-key-value"><?= e($pixPhone) ?></code>
            <button type="button" class="pix-copy">Copiar código Pix</button>
          </div>
          <?php if ($pixRecipient !== ''): ?>
          <span class="pix-recipient">Titular: <?= e($pixRecipient) ?></span>
          <?php endif; ?>
        </div>
      </div>
      <div class="pix-step">
        <span class="pix-step__number">2</span>
        <div>
          <h3>Envie o comprovante</h3>
          <p>Abra o WhatsApp pelo botão e anexe o comprovante na conversa. A mensagem já leva os dados da sua banda.</p>
          <a id="pix-whatsapp-link" class="pix-whatsapp" href="#" target="_blank" rel="noopener">Abrir WhatsApp e enviar comprovante</a>
        </div>
      </div>
      <p class="pix-modal__footnote">Seu plano será liberado após a conferência do pagamento.</p>
    </div>
  </div>
</div>
<script>
(() => {
  const modal = document.getElementById('pix-payment-modal');
  const dialog = modal.querySelector('.pix-modal__dialog');
  const label = document.getElementById('pix-plan-label');
  const value = document.getElementById('pix-plan-value');
  const whatsapp = document.getElementById('pix-whatsapp-link');
  const copyButton = modal.querySelector('.pix-copy');
  const closeButton = modal.querySelector('.pix-modal__close');
  const plans = <?= json_encode($paymentPlans, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
  let trigger = null;

  const closeModal = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
    trigger?.focus();
  };

  document.querySelectorAll('.js-pix-payment').forEach(button => {
    button.addEventListener('click', () => {
      const plan = plans[button.dataset.plan];
      if (!plan) return;
      trigger = button;
      label.textContent = plan.label;
      value.textContent = plan.value;
      whatsapp.href = plan.whatsapp;
      copyButton.textContent = 'Copiar código Pix';
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      closeButton.focus();
    });
  });

  copyButton.addEventListener('click', async () => {
    const key = document.getElementById('pix-key-value').textContent.trim();
    try {
      await navigator.clipboard.writeText(key);
    } catch (_) {
      const field = document.createElement('textarea');
      field.value = key;
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    copyButton.textContent = 'Copiado!';
  });

  closeButton.addEventListener('click', closeModal);
  modal.addEventListener('click', event => {
    if (!dialog.contains(event.target)) closeModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
    if (event.key === 'Tab' && !modal.hidden) {
      const focusable = [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(item => !item.disabled && item.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
})();
</script>
<?php endif; ?>
</body>
</html>
