<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="csrf-token" content="<?= e(csrf_token()) ?>" />
  <title>Sair da conta — Cifrô</title>
  <style>
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      background: #000;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      max-width: 420px;
      width: 100%;
      border: 1px solid #333;
      border-radius: 16px;
      padding: 24px;
      background: #111;
      text-align: center;
    }
    h1 { margin: 0 0 8px; font-size: 20px; }
    p { margin: 0 0 20px; opacity: 0.85; font-size: 14px; line-height: 1.5; }
    .acoes { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
    button, a.voltar {
      font: inherit;
      padding: 10px 18px;
      border-radius: 10px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    button { background: #ef4444; color: #fff; border: 0; font-weight: 600; }
    a.voltar { background: transparent; color: #fff; border: 1px solid #444; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sair da conta?</h1>
    <p>Este aparelho vai esquecer seu login e você precisará entrar de novo com a senha.</p>
    <form method="post" action="<?= e(base_url('/logout.php')) ?>" class="acoes">
      <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>" />
      <button type="submit" id="confirmarLogout">Sair da conta</button>
      <a class="voltar" href="<?= e(base_url('/index.php')) ?>">Cancelar</a>
    </form>
  </div>
</body>
</html>
