<?php
require_once __DIR__ . '/src/backend/bootstrap.php';

$token  = trim($_GET['token'] ?? $_POST['token'] ?? '');
$erro   = '';
$ok     = false;
$repo   = new UserRepository();
$flow   = new AccountActivationFlow($repo);

$tokenInvalido = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $senha  = $_POST['senha']  ?? '';
    $senha2 = $_POST['senha2'] ?? '';

    $result = $flow->handleSubmit($token, $senha, $senha2);
    $erro = $result['erro'];
    $ok = $result['ok'];
    $tokenInvalido = $result['tokenInvalido'];

    if ($ok && $result['session'] !== null) {
        if (session_status() === PHP_SESSION_ACTIVE && !headers_sent()) {
            session_regenerate_id(true);
        }
        foreach ($result['session'] as $key => $value) {
            $_SESSION[$key] = $value;
        }
        // Veio da landing clicando num plano pago: leva direto para a contratação.
        // Best-effort — só vale se a ativação foi aberta no mesmo navegador do cadastro.
        $destino = $result['redirect'];
        if (!empty($_SESSION['cifro_plano_intencao'])) {
            $destino = '/plano.php';
            unset($_SESSION['cifro_plano_intencao']);
        }
        header('Location: ' . base_url($destino));
        exit;
    }
} else {
    // GET: validate token is still good before showing form
    $erro = $flow->checkTokenForDisplay($token) ?? '';
    $tokenInvalido = $erro !== '';
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php csrf_meta(); ?>
  <title>Definir senha — Cifrô</title>
  <script src="/src/js/cifro-theme.js"></script>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <link href="/src/css/theme.css" rel="stylesheet">
  <style>
    body { display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#0f0f0f,#1a1a2e);padding:20px;box-sizing:border-box;font-family:var(--font-ui,sans-serif); }
    .card { background:var(--bg-2,#1e1e1e);border:1px solid var(--border-1,#333);border-radius:16px;padding:36px 32px;max-width:420px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.5); }
    .brand { display:flex;justify-content:center;margin-bottom:24px; }
    .brand img { width:132px;height:auto; }
    h2 { margin:0 0 18px;font-size:18px;color:#fff;text-align:center; }
    .form-group { margin-bottom:14px; }
    label { display:block;font-size:13px;color:#aaa;margin-bottom:5px;font-weight:500; }
    input { width:100%;height:42px;padding:0 12px;box-sizing:border-box;background:#111;color:#fff;border:1px solid #333;border-radius:8px;font-family:inherit;font-size:14px; }
    input:focus { outline:none;border-color:#7c3aed; }
    .btn { width:100%;height:44px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;margin-top:8px; }
    .btn:hover { background:#6d28d9; }
    .error { background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#f87171;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px; }
    .link { text-align:center;margin-top:18px;font-size:13px;color:#666; }
    .link a { color:#7c3aed;text-decoration:none; }
  </style>
</head>
<body>
  <div class="card">
    <a class="brand" href="/landing.php" aria-label="Cifrô"><img src="/src/images/cifro-logo.svg" alt="Cifrô"></a>
    <h2>Definir senha</h2>

    <?php if ($tokenInvalido): ?>
      <div class="error"><?= htmlspecialchars($erro) ?></div>
      <div class="link"><a href="/esqueci-senha.php">Solicitar novo link</a></div>
    <?php elseif ($ok): ?>
      <p style="color:#aaa;text-align:center">Senha definida! <a href="/login.php" style="color:#7c3aed">Entrar</a></p>
    <?php else: ?>
      <?php if ($erro): ?>
        <div class="error" id="server-erro"><?= htmlspecialchars($erro) ?></div>
      <?php endif; ?>
      <form method="post" novalidate id="senha-form">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(csrf_token()) ?>">
        <input type="hidden" name="token" value="<?= htmlspecialchars($token) ?>">

        <div class="form-group">
          <label for="senha">Nova senha</label>
          <input type="password" id="senha" name="senha" placeholder="Mínimo 6 caracteres" minlength="6" autocomplete="new-password" required>
        </div>
        <div class="form-group">
          <label for="senha2">Confirmar senha</label>
          <input type="password" id="senha2" name="senha2" placeholder="Repita a senha" required>
        </div>
        <div class="error" id="client-erro" style="display:none"></div>

        <button type="submit" class="btn">Ativar minha conta</button>
      </form>
      <script>
        document.getElementById('senha-form').addEventListener('submit', function (e) {
          var senha = document.getElementById('senha').value;
          var senha2 = document.getElementById('senha2').value;
          var erroEl = document.getElementById('client-erro');
          var msg = '';
          if (senha.length < 6) {
            msg = 'A senha deve ter pelo menos 6 caracteres.';
          } else if (senha !== senha2) {
            msg = 'As senhas não coincidem.';
          }
          if (msg) {
            e.preventDefault();
            erroEl.textContent = msg;
            erroEl.style.display = 'block';
          } else {
            erroEl.style.display = 'none';
          }
        });
      </script>
    <?php endif; ?>
  </div>
</body>
</html>
