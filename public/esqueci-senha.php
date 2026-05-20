<?php
require_once __DIR__ . '/src/backend/bootstrap.php';

$erro    = '';
$success = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();

    if (fdm_rate_limit('reset_senha', 5, 300)) {
        $success = true; // Don't leak rate limit info — show same success message
    } else {

    $q    = trim($_POST['email'] ?? '');
    $repo = new UserRepository();

    if (!$q) {
        $erro = 'Informe seu e-mail ou username.';
    } else {
        $user = $repo->findByUsernameOrEmail($q);
        if ($user && $user['email']) {
            $token = $repo->createToken($user['id'], 3600); // 1 hour
            try {
                MailService::sendPasswordReset($user, $token);
            } catch (Exception $e) {
                // Silently fail — don't leak whether email exists
            }
        }
        // Always show success to avoid user enumeration
        $success = true;
    }

    } // end rate limit else
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php csrf_meta(); ?>
  <title>Esqueci a senha — StageBox</title>
  <script src="/src/js/fdm-theme.js"></script>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <link href="/src/css/theme.css" rel="stylesheet">
  <style>
    body { display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#0f0f0f,#1a1a2e);padding:20px;box-sizing:border-box;font-family:var(--font-ui,sans-serif); }
    .card { background:var(--bg-2,#1e1e1e);border:1px solid var(--border-1,#333);border-radius:16px;padding:36px 32px;max-width:420px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.5); }
    .brand { text-align:center;margin-bottom:24px;font-size:20px;font-weight:700;color:#fff; }
    h2 { margin:0 0 8px;font-size:18px;color:#fff;text-align:center; }
    .sub { color:#888;font-size:13px;text-align:center;margin-bottom:20px;line-height:1.5; }
    .form-group { margin-bottom:14px; }
    label { display:block;font-size:13px;color:#aaa;margin-bottom:5px;font-weight:500; }
    input { width:100%;height:42px;padding:0 12px;box-sizing:border-box;background:#111;color:#fff;border:1px solid #333;border-radius:8px;font-family:inherit;font-size:14px; }
    input:focus { outline:none;border-color:#7c3aed; }
    .btn { width:100%;height:44px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;margin-top:8px; }
    .btn:hover { background:#6d28d9; }
    .error { background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#f87171;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px; }
    .success-box { text-align:center; }
    .link { text-align:center;margin-top:18px;font-size:13px;color:#666; }
    .link a { color:#7c3aed;text-decoration:none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">StageBox - Cifras</div>
    <h2>Esqueci minha senha</h2>

    <?php if ($success): ?>
      <div class="success-box">
        <p style="color:#aaa;font-size:14px;line-height:1.6">
          Se esse e-mail ou username estiver cadastrado, você receberá um link de redefinição em instantes.<br><br>
          Verifique também a pasta de spam.
        </p>
      </div>
    <?php else: ?>
      <p class="sub">Informe seu e-mail ou username e enviaremos um link para redefinir sua senha.</p>

      <?php if ($erro): ?>
        <div class="error"><?= htmlspecialchars($erro) ?></div>
      <?php endif; ?>

      <form method="post" novalidate>
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(csrf_token()) ?>">
        <div class="form-group">
          <label for="email">E-mail ou username</label>
          <input type="text" id="email" name="email" placeholder="seu@email.com ou username" required
            value="<?= htmlspecialchars($_POST['email'] ?? '') ?>">
        </div>
        <button type="submit" class="btn">Enviar link</button>
      </form>
    <?php endif; ?>

    <div class="link"><a href="/login.php">← Voltar ao login</a></div>
  </div>
</body>
</html>
