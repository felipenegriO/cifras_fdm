<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php csrf_meta(); ?>
  <title>Criar conta — StageBox</title>
  <script src="/src/js/fdm-theme.js"></script>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <link href="/src/css/theme.css" rel="stylesheet">
  <style>
    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%); padding: 20px; box-sizing: border-box; font-family: var(--font-ui, sans-serif); }
    .card { background: var(--bg-2, #1e1e1e); border: 1px solid var(--border-1, #333); border-radius: 16px; padding: 36px 32px; max-width: 440px; width: 100%; box-shadow: 0 12px 40px rgba(0,0,0,.5); }
    .brand { text-align: center; margin-bottom: 28px; }
    .brand-name { font-size: 22px; font-weight: 700; color: #fff; }
    .brand-sub  { font-size: 13px; color: #888; margin-top: 4px; }
    h2 { margin: 0 0 20px; font-size: 20px; color: #fff; text-align: center; }
    .form-group { margin-bottom: 14px; }
    label { display: block; font-size: 13px; color: #aaa; margin-bottom: 5px; font-weight: 500; }
    input { width: 100%; height: 42px; padding: 0 12px; box-sizing: border-box; background: #111; color: #fff; border: 1px solid #333; border-radius: 8px; font-family: inherit; font-size: 14px; }
    input:focus { outline: none; border-color: #7c3aed; }
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
      <div class="brand-name">StageBox - Cifras</div>
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

        <button type="submit" class="btn-submit">Criar conta grátis — 30 dias</button>
      </form>
    <?php endif; ?>

    <div class="footer-link">
      Já tem conta? <a href="/login.php">Entrar</a>
    </div>
  </div>
</body>
</html>
