<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
if (!isset($_SESSION['autenticado']) || $_SESSION['autenticado'] !== true) {
    header('Location: ' . base_url('/landing.php')); exit;
}
$bandaNome = $_SESSION['banda_atual']['nome'] ?? 'sua banda';
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Plano bloqueado — Cifrô</title>
  <script src="/src/js/cifro-theme.js"></script>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <link href="/src/css/theme.css" rel="stylesheet">
  <style>
    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: var(--bg-0); color: var(--text-1); font-family: var(--font-ui, sans-serif); padding: 20px; box-sizing: border-box; }
    .card { background: var(--bg-2); border: 1px solid var(--border-1); border-radius: var(--radius-lg); padding: 40px 32px; max-width: 440px; width: 100%; text-align: center; box-shadow: var(--shadow-3); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: var(--text-xl); margin: 0 0 8px; }
    .sub { color: var(--text-2); font-size: var(--text-sm); margin-bottom: 28px; line-height: 1.6; }
    .actions { display: flex; flex-direction: column; gap: 10px; }
    .btn-lg { display: block; padding: 13px 20px; border-radius: var(--radius-md); font-family: inherit; font-size: var(--text-base); font-weight: var(--fw-medium); cursor: pointer; border: none; text-decoration: none; text-align: center; }
    .btn-primary { background: var(--brand); color: #fff; }
    .btn-primary:hover { opacity: .9; }
    .btn-ghost { background: transparent; border: 1px solid var(--border-2); color: var(--text-2); }
    .btn-ghost:hover { background: var(--bg-3); }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔒</div>
    <h1>Plano bloqueado</h1>
    <p class="sub">
      O acesso de <strong><?= htmlspecialchars($bandaNome) ?></strong> está suspenso.
      Regularize o pagamento para continuar usando o Cifrô.
    </p>
    <div class="actions">
      <a href="/plano.php#planos" class="btn-lg btn-primary">
        Regularizar plano
      </a>
      <a href="/login.php?logout=1" class="btn-lg btn-ghost">Sair</a>
    </div>
  </div>
</body>
</html>
