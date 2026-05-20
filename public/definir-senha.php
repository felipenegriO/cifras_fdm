<?php
require_once __DIR__ . '/src/backend/bootstrap.php';

$token  = trim($_GET['token'] ?? $_POST['token'] ?? '');
$erro   = '';
$ok     = false;
$repo   = new UserRepository();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $senha  = $_POST['senha']  ?? '';
    $senha2 = $_POST['senha2'] ?? '';

    if (strlen($senha) < 6) {
        $erro = 'A senha deve ter pelo menos 6 caracteres.';
    } elseif ($senha !== $senha2) {
        $erro = 'As senhas não coincidem.';
    } else {
        $userId = $repo->consumeToken($token);
        if (!$userId) {
            $erro = 'Link inválido ou expirado. Solicite um novo.';
        } else {
            $hash = password_hash($senha, PASSWORD_DEFAULT);
            $repo->activate($userId, $hash);

            // Auto-login
            $user = $repo->findById($userId);
            if ($user) {
                $bandas = $repo->getBandasDoUsuario($userId);
                session_regenerate_id(true);
                $_SESSION['autenticado'] = true;
                $_SESSION['usuario'] = [
                    'id'       => $user['id'],
                    'nome'     => $user['nome'],
                    'username' => $user['username'],
                    'perfil'   => $user['perfil'],
                    'validade' => $user['validade'] ?? '',
                    'config'   => $user['config'] ?? [],
                    'bandas'   => array_map(fn($b) => ['id' => $b['id'], 'perfil' => $b['usuario_perfil']], $bandas),
                ];
                if (count($bandas) === 1) {
                    $banda = (new BandaRepository())->findById($bandas[0]['id']);
                    if ($banda) {
                        $_SESSION['banda_atual'] = [
                            'id'             => $banda['id'],
                            'nome'           => $banda['nome'],
                            'perfil'         => $bandas[0]['usuario_perfil'],
                            'plano'          => $banda['plano'],
                            'trial_expira_em'=> $banda['trial_expira_em'],
                        ];
                    }
                    header('Location: /index.php'); exit;
                }
                header('Location: /select-banda.php'); exit;
            }
            $ok = true;
        }
    }
} else {
    // GET: validate token is still good before showing form
    if (!$token || !$repo->peekToken($token)) {
        $erro = 'Link inválido ou expirado. Solicite um novo.';
    }
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php csrf_meta(); ?>
  <title>Definir senha — StageBox</title>
  <script src="/src/js/fdm-theme.js"></script>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <link href="/src/css/theme.css" rel="stylesheet">
  <style>
    body { display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#0f0f0f,#1a1a2e);padding:20px;box-sizing:border-box;font-family:var(--font-ui,sans-serif); }
    .card { background:var(--bg-2,#1e1e1e);border:1px solid var(--border-1,#333);border-radius:16px;padding:36px 32px;max-width:420px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.5); }
    .brand { text-align:center;margin-bottom:24px;font-size:20px;font-weight:700;color:#fff; }
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
    <div class="brand">StageBox - Cifras</div>
    <h2>Definir senha</h2>

    <?php if ($erro): ?>
      <div class="error"><?= htmlspecialchars($erro) ?></div>
      <div class="link"><a href="/esqueci-senha.php">Solicitar novo link</a></div>
    <?php elseif ($ok): ?>
      <p style="color:#aaa;text-align:center">Senha definida! <a href="/login.php" style="color:#7c3aed">Entrar</a></p>
    <?php else: ?>
      <form method="post" novalidate>
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(csrf_token()) ?>">
        <input type="hidden" name="token" value="<?= htmlspecialchars($token) ?>">

        <div class="form-group">
          <label for="senha">Nova senha</label>
          <input type="password" id="senha" name="senha" placeholder="Mínimo 6 caracteres" required>
        </div>
        <div class="form-group">
          <label for="senha2">Confirmar senha</label>
          <input type="password" id="senha2" name="senha2" placeholder="Repita a senha" required>
        </div>

        <button type="submit" class="btn">Ativar minha conta</button>
      </form>
    <?php endif; ?>
  </div>
</body>
</html>
