<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <?php if (!empty($activationToken)): ?><meta name="e2e-activation-token" content="<?= e($activationToken) ?>"><?php endif; ?>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php csrf_meta(); ?>
  <title>Criar conta — Cifrô</title>
  <script src="/src/js/cifro-theme.js"></script>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <link href="/src/css/theme.css" rel="stylesheet">
  <style>
    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%); padding: 20px; box-sizing: border-box; font-family: var(--font-ui, sans-serif); }
    .card { background: var(--bg-2, #1e1e1e); border: 1px solid var(--border-1, #333); border-radius: 16px; padding: 36px 32px; max-width: 440px; width: 100%; box-shadow: 0 12px 40px rgba(0,0,0,.5); }
    .brand { text-align: center; margin-bottom: 28px; }
    .brand img { width: 132px; height: auto; }
    .brand-sub  { font-size: 13px; color: #888; margin-top: 4px; }
    h2 { margin: 0 0 20px; font-size: 20px; color: #fff; text-align: center; }
    .form-group { margin-bottom: 14px; }
    label { display: block; font-size: 13px; color: #aaa; margin-bottom: 5px; font-weight: 500; }
    input { width: 100%; height: 42px; padding: 0 12px; box-sizing: border-box; background: #111; color: #fff; border: 1px solid #333; border-radius: 8px; font-family: inherit; font-size: 14px; }
    input:focus { outline: none; border-color: #7c3aed; }
    .legal-consent { display:flex; gap:9px; align-items:flex-start; color:#aaa; font-size:12px; line-height:1.45; }
    .legal-consent input { width:16px; height:16px; flex:0 0 auto; margin-top:2px; }
    .legal-consent a { color:#a78bfa; }
    .btn-submit { width: 100%; height: 44px; background: #7c3aed; color: #fff; border: none; border-radius: 8px; font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px; }
    .btn-submit:hover { background: #6d28d9; }
    .error { background: rgba(239,68,68,.15); border: 1px solid rgba(239,68,68,.4); color: #f87171; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 14px; }
    .success-box { text-align: center; }
    .success-icon { font-size: 48px; margin-bottom: 16px; }
    .success-title { font-size: 20px; font-weight: 600; color: #fff; margin: 0 0 10px; }
    .success-msg { color: #aaa; font-size: 14px; line-height: 1.6; }
    .footer-link { text-align: center; margin-top: 20px; font-size: 13px; color: #666; }
    .footer-link a { color: #7c3aed; text-decoration: none; }
    .footer-link a:hover { text-decoration: underline; }
    .divider { border: none; border-top: 1px solid #2a2a2a; margin: 18px 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <img src="/src/images/cifro-logo.svg" alt="Cifrô">
      <div class="brand-sub">Sua banda na mesma página. Sempre.</div>
    </div>

    <?php if ($success): ?>
      <div class="success-box">
        <div class="success-icon">✉️</div>
        <h2 class="success-title">Verifique seu e-mail</h2>
        <p class="success-msg">
          Enviamos um link de ativação para <strong><?= htmlspecialchars($email ?? '') ?></strong>.<br>
          Clique no link para definir sua senha e ativar sua conta.<br><br>
          <small>Não recebeu? Verifique a pasta de spam.</small>
        </p>
      </div>
    <?php else: ?>
      <h2>Criar conta grátis</h2>

      <?php if ($erro): ?>
        <div class="error"><?= htmlspecialchars($erro) ?></div>
      <?php endif; ?>

      <?php $googleConfigured = google_oauth_configured(); ?>
      <?php if ($googleConfigured): ?>
        <a href="/api/auth/google/start.php?source=register" id="googleRegisterLink" class="btn btn-google" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:44px;background:#fff;color:#3c4043;border:1px solid #dadce0;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;margin-bottom:16px;">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>
          Continuar com Google
        </a>
        <div style="text-align:center;margin-bottom:16px;color:#666;font-size:12px">ou crie com e-mail</div>
      <?php endif; ?>

      <form method="post" novalidate>
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(csrf_token()) ?>">

        <div class="form-group">
          <label for="nome">Seu nome</label>
          <input type="text" id="nome" name="nome" placeholder="Como te chamam?" required
            value="<?= htmlspecialchars($_POST['nome'] ?? '') ?>">
        </div>

        <div class="form-group">
          <label for="email">E-mail</label>
          <input type="email" id="email" name="email" placeholder="seu@email.com" required
            value="<?= htmlspecialchars($_POST['email'] ?? '') ?>">
        </div>

        <hr class="divider">

        <div class="form-group">
          <label for="banda_nome">Nome da banda</label>
          <input type="text" id="banda_nome" name="banda_nome" placeholder="Ex: Minha Banda" required
            value="<?= htmlspecialchars($_POST['banda_nome'] ?? '') ?>">
        </div>

        <label class="legal-consent" for="legal_acceptance">
          <input type="checkbox" id="legal_acceptance" name="legal_acceptance" value="1" required <?= isset($_POST['legal_acceptance']) ? 'checked' : '' ?>>
          <span>Li e aceito os <a href="<?= htmlspecialchars((string)env('TERMS_URL', '/termos.php')) ?>" target="_blank" rel="noopener">Termos de Uso</a> e a <a href="<?= htmlspecialchars((string)env('PRIVACY_URL', '/privacidade.php')) ?>" target="_blank" rel="noopener">Política de Privacidade</a>.</span>
        </label>

        <button type="submit" class="btn-submit">Criar conta grátis</button>
      </form>
    <?php endif; ?>

    <div class="footer-link">
      Já tem conta? <a href="/login.php">Entrar</a>
    </div>
  </div>
  <script>
    document.getElementById('googleRegisterLink')?.addEventListener('click', event => {
      if (!document.getElementById('legal_acceptance')?.checked) {
        event.preventDefault();
        alert('Aceite os Termos de Uso e a Política de Privacidade para continuar.');
        return;
      }
      event.currentTarget.href = '/api/auth/google/start.php?source=register&legal_acceptance=1';
    });
  </script>
</body>
</html>
